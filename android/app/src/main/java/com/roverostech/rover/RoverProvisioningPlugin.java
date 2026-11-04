package com.roverostech.rover;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.URL;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

@CapacitorPlugin(name = "RoverProvisioning")
public class RoverProvisioningPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void request(PluginCall call) {
        String urlValue = call.getString("url");
        String fingerprint = normalizeFingerprint(call.getString("fingerprint"));
        String method = call.getString("method", "GET");
        String pairingCode = call.getString("pairingCode", "");
        String body = call.getString("body", "");

        if (urlValue == null || fingerprint == null ||
            !("GET".equals(method) || "POST".equals(method)) ||
            !pairingCode.matches("(?i)^[a-f0-9]{32}$") ||
            body.length() > 8192) {
            call.reject("Invalid provisioning request.");
            return;
        }

        final URL url;
        try {
            url = new URL(urlValue);
            if (!"https".equals(url.getProtocol()) || url.getPort() != 5443 ||
                url.getUserInfo() != null || url.getQuery() != null || url.getRef() != null ||
                !url.getPath().matches("^/api/provisioning/(status|networks|wifi|retry)$") ||
                !isAllowedHost(url.getHost())) {
                call.reject("Provisioning requests must use the local RoverOS setup service.");
                return;
            }
        } catch (Exception error) {
            call.reject("Invalid MiniPC setup address.");
            return;
        }

        executor.execute(() -> {
            HttpsURLConnection connection = null;
            try {
                final byte[] expected = hexToBytes(fingerprint);
                X509TrustManager pinTrustManager = new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType)
                        throws CertificateException { }

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType)
                        throws CertificateException {
                        if (chain == null || chain.length == 0) {
                            throw new CertificateException("MiniPC certificate is missing.");
                        }
                        try {
                            chain[0].checkValidity();
                            byte[] actual = MessageDigest.getInstance("SHA-256").digest(chain[0].getEncoded());
                            if (!MessageDigest.isEqual(expected, actual)) {
                                throw new CertificateException("MiniPC certificate fingerprint does not match.");
                            }
                        } catch (CertificateException error) {
                            throw error;
                        } catch (Exception error) {
                            throw new CertificateException("Could not verify MiniPC certificate.");
                        }
                    }

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                };
                SSLContext context = SSLContext.getInstance("TLS");
                context.init(null, new TrustManager[] { pinTrustManager }, new SecureRandom());
                connection = (HttpsURLConnection) url.openConnection();
                connection.setSSLSocketFactory(context.getSocketFactory());
                HostnameVerifier pinnedHostnameVerifier = (hostname, session) -> isAllowedHost(hostname);
                connection.setHostnameVerifier(pinnedHostnameVerifier);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(15000);
                connection.setRequestMethod(method);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Authorization", "Bearer " + pairingCode);
                connection.setUseCaches(false);
                if ("POST".equals(method)) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.getOutputStream().write(body.getBytes("UTF-8"));
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String responseBody = stream == null ? "" : readLimited(stream, 65536);
                JSObject result = new JSObject();
                result.put("status", status);
                result.put("body", responseBody);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not securely connect to the MiniPC setup service.");
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private static String normalizeFingerprint(String value) {
        if (value == null) return null;
        String normalized = value.replace(":", "").replace("SHA256", "").replace("sha256", "")
            .replace("=", "").trim().toLowerCase(Locale.ROOT);
        return normalized.matches("^[a-f0-9]{64}$") ? normalized : null;
    }

    private static byte[] hexToBytes(String value) {
        byte[] result = new byte[value.length() / 2];
        for (int i = 0; i < result.length; i++) {
            result[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        }
        return result;
    }

    private static boolean isAllowedHost(String host) {
        if ("roveros-server.local".equalsIgnoreCase(host) ||
            "roveros-server".equalsIgnoreCase(host)) return true;
        try {
            java.net.InetAddress address = java.net.InetAddress.getByName(host);
            if (!(address instanceof Inet4Address)) return false;
            byte[] bytes = address.getAddress();
            int first = bytes[0] & 0xff;
            int second = bytes[1] & 0xff;
            return first == 10 || first == 192 && second == 168 ||
                first == 172 && second >= 16 && second <= 31 ||
                first == 169 && second == 254;
        } catch (Exception error) {
            return false;
        }
    }

    private static String readLimited(InputStream stream, int maxBytes) throws Exception {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > maxBytes) throw new Exception("Response too large.");
                output.write(buffer, 0, count);
            }
            return output.toString("UTF-8");
        }
    }
}
