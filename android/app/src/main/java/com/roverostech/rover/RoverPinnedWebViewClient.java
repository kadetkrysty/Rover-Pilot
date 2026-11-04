package com.roverostech.rover;

import android.net.Uri;
import android.net.http.SslCertificate;
import android.net.http.SslError;
import android.os.Bundle;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.security.MessageDigest;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Locale;

public final class RoverPinnedWebViewClient extends BridgeWebViewClient {
    public RoverPinnedWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
        try {
            Uri uri = Uri.parse(error.getUrl());
            if (!("https".equals(uri.getScheme()) || "wss".equals(uri.getScheme())) ||
                uri.getPort() != 5443 ||
                !isAllowedHost(uri.getHost())) {
                handler.cancel();
                return;
            }
            String configured = view.getContext()
                .getSharedPreferences("roveros-secure-connection", 0)
                .getString("certificate-fingerprint", "");
            if (configured == null || !configured.matches("(?i)^[a-f0-9]{64}$")) {
                handler.cancel();
                return;
            }

            Bundle state = SslCertificate.saveState(error.getCertificate());
            byte[] der = state == null ? null : state.getByteArray("x509-certificate");
            if (der == null) {
                handler.cancel();
                return;
            }
            X509Certificate certificate = (X509Certificate) CertificateFactory
                .getInstance("X.509").generateCertificate(new ByteArrayInputStream(der));
            certificate.checkValidity();
            byte[] actual = MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded());
            byte[] expected = hexToBytes(configured.toLowerCase(Locale.ROOT));
            if (MessageDigest.isEqual(expected, actual)) handler.proceed();
            else handler.cancel();
        } catch (Exception exception) {
            handler.cancel();
        }
    }

    private static byte[] hexToBytes(String value) {
        byte[] result = new byte[value.length() / 2];
        for (int i = 0; i < result.length; i++) {
            result[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        }
        return result;
    }

    private static boolean isAllowedHost(String host) {
        if (host == null) return false;
        if ("roveros-server.local".equalsIgnoreCase(host) ||
            "roveros-server".equalsIgnoreCase(host)) return true;
        if (!host.matches("^[0-9]{1,3}(\\.[0-9]{1,3}){3}$")) return false;
        try {
            InetAddress address = InetAddress.getByName(host);
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
}
