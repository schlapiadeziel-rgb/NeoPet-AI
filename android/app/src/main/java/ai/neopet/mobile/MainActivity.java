package ai.neopet.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST = 41;
    private static final int FILE_CHOOSER_REQUEST = 42;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 43;
    private WebView webView;
    private PermissionRequest pendingAudioRequest;
    private ValueCallback<Uri[]> pendingFileCallback;
    private boolean pendingOverlayStart;
    private boolean pendingStartVoice;
    private boolean pageReady;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        pendingStartVoice = getIntent().getBooleanExtra("start_voice", false);
        webView.addJavascriptInterface(new AndroidBridge(), "NeoPetAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme()) && uri.getPath() != null && uri.getPath().startsWith("/android_asset/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                return true;
            }

            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                triggerPendingVoice();
                notifyOverlayState();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                Intent intent = params.createIntent();
                try { startActivityForResult(intent, FILE_CHOOSER_REQUEST); }
                catch (Exception error) { pendingFileCallback = null; return false; }
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }

    private final class AndroidBridge {
        @JavascriptInterface public boolean isOverlayAvailable() {
            return Build.VERSION.SDK_INT >= 23;
        }

        @JavascriptInterface public boolean isOverlayGranted() {
            return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(MainActivity.this);
        }

        @JavascriptInterface public boolean isOverlayRunning() {
            return OverlayPetService.isRunning();
        }

        @JavascriptInterface public void selectPet(String petId) {
            if (!isKnownPet(petId)) return;
            getSharedPreferences("neopet", MODE_PRIVATE).edit().putString("pet_id", petId).apply();
            if (OverlayPetService.isRunning()) {
                stopService(new Intent(MainActivity.this, OverlayPetService.class));
                webView.postDelayed(MainActivity.this::startOverlayService, 180);
            }
        }

        @JavascriptInterface public void enableOverlay() {
            runOnUiThread(() -> requestOverlayFlow());
        }

        @JavascriptInterface public void disableOverlay() {
            runOnUiThread(() -> {
                stopService(new Intent(MainActivity.this, OverlayPetService.class));
                notifyOverlayState();
            });
        }
    }

    private boolean isKnownPet(String petId) {
        return "xiaonuo".equals(petId) || "yuntuan".equals(petId) || "yueli".equals(petId);
    }

    private void requestOverlayFlow() {
        pendingOverlayStart = true;
        if (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)) {
            requestNotificationAndStartOverlay();
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getPackageName())
        );
        try { startActivity(intent); }
        catch (Exception error) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
    }

    private void requestNotificationAndStartOverlay() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
            return;
        }
        startOverlayService();
    }

    private void startOverlayService() {
        pendingOverlayStart = false;
        Intent intent = new Intent(this, OverlayPetService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent);
        else startService(intent);
        webView.postDelayed(this::notifyOverlayState, 350);
    }

    private void notifyOverlayState() {
        if (!pageReady || webView == null) return;
        boolean granted = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this);
        boolean running = OverlayPetService.isRunning();
        String script = "window.dispatchEvent(new CustomEvent('neopet-overlay-state',{detail:{available:true,granted:"
            + granted + ",running:" + running + "}}))";
        webView.evaluateJavascript(script, null);
    }

    private void triggerPendingVoice() {
        if (!pageReady || !pendingStartVoice || webView == null) return;
        pendingStartVoice = false;
        webView.evaluateJavascript("document.getElementById('micButton')?.click()", null);
    }

    private void handleWebPermission(PermissionRequest request) {
        boolean wantsAudio = false;
        for (String resource : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio = true;
        if (!wantsAudio) { request.deny(); return; }
        if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            pendingAudioRequest = request;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == AUDIO_PERMISSION_REQUEST && pendingAudioRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingAudioRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingAudioRequest.deny();
            pendingAudioRequest = null;
        } else if (requestCode == NOTIFICATION_PERMISSION_REQUEST && pendingOverlayStart) {
            startOverlayService();
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFileCallback = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        pendingStartVoice = intent.getBooleanExtra("start_voice", false);
        triggerPendingVoice();
    }

    @Override protected void onResume() {
        super.onResume();
        if (pendingOverlayStart && (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this))) {
            requestNotificationAndStartOverlay();
        } else {
            notifyOverlayState();
        }
    }

    @Override protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
