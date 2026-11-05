package com.roverostech.rover;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.UUID;

/** User-selected file export; never accepts a filesystem path from JavaScript. */
@CapacitorPlugin(name = "RoverMedia")
public class RoverMediaPlugin extends Plugin {
    private OutputStream output;
    private Uri destination;
    private String exportId;
    private long written;
    private long total;
    private boolean choosing;

    @PluginMethod
    public synchronized void beginSave(PluginCall call) {
        String name = call.getString("fileName", "");
        String type = call.getString("mimeType", "");
        Integer size = call.getInt("total", 0);
        if (choosing || output != null) {
            call.reject("Another video export is already in progress.");
            return;
        }
        if (!name.matches("^[A-Za-z0-9.TZ -]+\\.(mp4|webm)$") || name.length() > 200 ||
            !("video/mp4".equals(type) || "video/webm".equals(type)) ||
            size <= 0 || size > 32 * 1024 * 1024) {
            call.reject("Invalid video export.");
            return;
        }
        total = size;
        choosing = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(call, intent, "destinationSelected");
        } catch (Exception error) {
            choosing = false;
            call.reject("The system document picker is unavailable.");
        }
    }

    @ActivityCallback
    private synchronized void destinationSelected(PluginCall call, ActivityResult result) {
        choosing = false;
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Video export canceled.");
            return;
        }
        try {
            destination = data.getData();
            output = getContext().getContentResolver().openOutputStream(destination, "w");
            if (output == null) throw new IllegalStateException();
            written = 0;
            exportId = UUID.randomUUID().toString();
            JSObject response = new JSObject();
            response.put("id", exportId);
            call.resolve(response);
        } catch (Exception error) {
            discard();
            call.reject("Could not open the selected video destination.");
        }
    }

    @PluginMethod
    public synchronized void appendSave(PluginCall call) {
        String data = call.getString("data", "");
        if (output == null || exportId == null || !exportId.equals(call.getString("id")) ||
            data.isEmpty() || data.length() > 262144 || !data.matches("^[A-Za-z0-9+/]*={0,2}$")) {
            call.reject("Invalid video export chunk.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            if (bytes.length > 192 * 1024 || written + bytes.length > total) {
                throw new IllegalArgumentException();
            }
            output.write(bytes);
            written += bytes.length;
            call.resolve();
        } catch (Exception error) {
            discard();
            call.reject("Could not write the video export.");
        }
    }

    @PluginMethod
    public synchronized void finishSave(PluginCall call) {
        if (output == null || exportId == null || !exportId.equals(call.getString("id")) || written != total) {
            call.reject("The video export is incomplete.");
            return;
        }
        try {
            output.close();
            output = null;
            destination = null;
            exportId = null;
            call.resolve();
        } catch (Exception error) {
            discard();
            call.reject("Could not complete the video export.");
        }
    }

    @PluginMethod
    public synchronized void cancelSave(PluginCall call) {
        if (exportId != null && exportId.equals(call.getString("id"))) discard();
        call.resolve();
    }

    private void discard() {
        try { if (output != null) output.close(); } catch (Exception ignored) { }
        output = null;
        if (destination != null) {
            try { DocumentsContract.deleteDocument(getContext().getContentResolver(), destination); }
            catch (Exception ignored) { /* Some document providers cannot delete a partial file. */ }
        }
        destination = null;
        exportId = null;
    }

    @Override
    protected synchronized void handleOnDestroy() {
        discard();
        super.handleOnDestroy();
    }
}
