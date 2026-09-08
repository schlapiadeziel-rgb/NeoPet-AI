package ai.neopet.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int MEDIA_PERMISSION_REQUEST = 41;
    private static final int FILE_CHOOSER_REQUEST = 42;
    private WebView webView;
    private PermissionRequest pendingMediaRequest;
    private ValueCallback<Uri[]> pendingFileCallback;
    private final ExecutorService networkExecutor = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, String> modelDownloadStates = new ConcurrentHashMap<>();
    private LocalModelController localModelController;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        localModelController = new LocalModelController(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView.addJavascriptInterface(new AndroidBridge(), "NeoAIAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST); }
                catch (Exception error) { pendingFileCallback = null; return false; }
                return true;
            }
        });
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private final class AndroidBridge {
        @JavascriptInterface public void requestJson(String requestId, String urlValue, String methodValue, String apiKey, String body) {
            networkExecutor.execute(() -> {
                String response = performJsonRequest(urlValue, methodValue, apiKey, body);
                runOnUiThread(() -> {
                    if (webView == null) return;
                    String script = "window.__neoaiResolveNativeRequest(" + JSONObject.quote(requestId) + "," + JSONObject.quote(response) + ")";
                    webView.evaluateJavascript(script, null);
                });
            });
        }

        @JavascriptInterface public boolean isAccessibilityEnabled() {
            return NeoAIAccessibilityService.isRunning();
        }

        @JavascriptInterface public String getInstalledAppPlugins() {
            JSONObject installed = new JSONObject();
            String[] ids = {"wechat", "qq", "douyin", "kuaishou", "bilibili", "xiaohongshu", "taobao", "jd", "alipay", "meituan", "eleme", "amap", "baidumap", "doubao", "deepseek", "wps"};
            for (String id : ids) try { installed.put(id, getPackageManager().getLaunchIntentForPackage(appPluginPackage(id)) != null); } catch (Exception ignored) { }
            return installed.toString();
        }

        @JavascriptInterface public String listLocalModels() {
            JSONArray models = new JSONArray();
            File[] files = modelDirectory().listFiles((dir, name) -> name.toLowerCase().endsWith(".gguf") && !name.endsWith(".part"));
            if (files != null) for (File file : files) {
                JSONObject item = new JSONObject();
                try { item.put("name", file.getName()); item.put("bytes", file.length()); models.put(item); } catch (Exception ignored) { }
            }
            return models.toString();
        }

        @JavascriptInterface public String downloadLocalModel(String requestId, String urlValue, String fileName) {
            JSONObject result = new JSONObject();
            try {
                if (requestId == null || requestId.length() > 100) throw new IllegalArgumentException("下载任务编号无效");
                URL url = new URL(urlValue);
                if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IllegalArgumentException("模型下载只允许 HTTPS");
                safeModelFile(fileName);
                JSONObject queued = new JSONObject(); queued.put("type", "progress"); queued.put("bytes", 0); queued.put("total", 0);
                modelDownloadStates.put(requestId, queued.toString());
                networkExecutor.execute(() -> downloadModel(requestId, urlValue, fileName));
                result.put("ok", true);
            } catch (Exception error) {
                try { result.put("ok", false); result.put("error", error.getMessage() == null ? "下载任务无法启动" : error.getMessage()); } catch (Exception ignored) { }
            }
            return result.toString();
        }

        @JavascriptInterface public String getLocalModelDownloadState(String requestId) {
            return modelDownloadStates.getOrDefault(requestId, "");
        }

        @JavascriptInterface public void requestLocalChat(String requestId, String modelName, String systemPrompt, String historyJson) {
            try {
                File model = safeModelFile(modelName);
                if (!model.isFile()) throw new IllegalArgumentException("请先在模型中心下载这个模型");
                JSONArray history = new JSONArray(historyJson == null ? "[]" : historyJson);
                StringBuilder prompt = new StringBuilder();
                int start = Math.max(0, history.length() - 12);
                for (int i = start; i < history.length(); i++) {
                    JSONObject item = history.optJSONObject(i); if (item == null) continue;
                    String role = "assistant".equals(item.optString("role")) ? "助手" : "用户";
                    String content = safeText(item.optString("content"), 4000);
                    if (!content.isEmpty()) prompt.append(role).append("：").append(content).append('\n');
                }
                localModelController.generate(model, safeText(systemPrompt, 12000), prompt.toString(), (reply, error) -> runOnUiThread(() -> {
                    JSONObject result = new JSONObject();
                    try { result.put("ok", error == null); if (error == null) result.put("reply", reply); else result.put("error", error); } catch (Exception ignored) { }
                    if (webView != null) webView.evaluateJavascript("window.__neoaiResolveLocalChat(" + JSONObject.quote(requestId) + "," + JSONObject.quote(result.toString()) + ")", null);
                }));
            } catch (Exception error) {
                JSONObject result = new JSONObject();
                try { result.put("ok", false); result.put("error", error.getMessage()); } catch (Exception ignored) { }
                runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.__neoaiResolveLocalChat(" + JSONObject.quote(requestId) + "," + JSONObject.quote(result.toString()) + ")", null); });
            }
        }

        @JavascriptInterface public void openAccessibilitySettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); }
                catch (Exception ignored) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
            });
        }

        @JavascriptInterface public String executeAction(String action, String argsJson) {
            JSONObject result = new JSONObject();
            try {
                JSONObject args = new JSONObject(argsJson == null ? "{}" : argsJson);
                if ("app_sequence".equals(action)) {
                    JSONArray steps = args.optJSONArray("steps");
                    if (!NeoAIAccessibilityService.isRunning()) throw new IllegalStateException("请先在设置中开启 NeoAI 跨 App 协助服务");
                    if (steps == null || !NeoAIAccessibilityService.runSteps(steps)) throw new IllegalArgumentException("操作步骤无效");
                } else {
                    Intent intent = buildActionIntent(action, args);
                    if (intent == null) throw new IllegalArgumentException("不支持的手机操作");
                    if (intent.resolveActivity(getPackageManager()) == null) throw new IllegalStateException("手机上没有可处理此操作的应用");
                    runOnUiThread(() -> startActivity(intent));
                }
                result.put("ok", true);
            } catch (Exception error) {
                try { result.put("ok", false); result.put("error", error.getMessage() == null ? "操作失败" : error.getMessage()); } catch (Exception ignored) { }
            }
            return result.toString();
        }
    }

    private Intent buildActionIntent(String action, JSONObject args) {
        switch (action) {
            case "wifi_settings": return new Intent(Settings.ACTION_WIFI_SETTINGS);
            case "bluetooth_settings": return new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            case "system_settings": return new Intent(Settings.ACTION_SETTINGS);
            case "app_settings": return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
            case "camera": return new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            case "wechat": {
                Intent intent = getPackageManager().getLaunchIntentForPackage("com.tencent.mm");
                if (intent == null) throw new IllegalStateException("手机上未安装微信");
                return intent;
            }
            case "alarm": return new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, bounded(args.optInt("hour", 8), 0, 23))
                .putExtra(AlarmClock.EXTRA_MINUTES, bounded(args.optInt("minute", 0), 0, 59))
                .putExtra(AlarmClock.EXTRA_MESSAGE, safeText(args.optString("message"), 80))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
            case "calendar": {
                Intent intent = new Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.Events.TITLE, safeText(args.optString("title"), 100));
                try { intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, Instant.parse(args.optString("beginTime")).toEpochMilli()); } catch (Exception ignored) { }
                return intent;
            }
            case "map": return new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(safeText(args.optString("query"), 200))));
            case "dial": return new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(safePhone(args.optString("number")))));
            case "sms": return new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(safePhone(args.optString("number")))))
                .putExtra("sms_body", safeText(args.optString("text"), 1000));
            case "share": return Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, safeText(args.optString("text"), 4000)), "选择分享目标");
            case "browser_search": return new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(safeText(args.optString("query"), 300))));
            case "app_launch": {
                Intent intent = getPackageManager().getLaunchIntentForPackage(appPluginPackage(args.optString("app")));
                if (intent == null) throw new IllegalStateException("手机上没有安装这个 App");
                return intent;
            }
            case "url": {
                Uri uri = Uri.parse(args.optString("url"));
                if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) return null;
                return new Intent(Intent.ACTION_VIEW, uri);
            }
            default: return null;
        }
    }

    private String performJsonRequest(String urlValue, String methodValue, String apiKey, String body) {
        JSONObject result = new JSONObject();
        HttpURLConnection connection = null;
        try {
            URL url = new URL(urlValue);
            if (!"http".equals(url.getProtocol()) && !"https".equals(url.getProtocol())) throw new IllegalArgumentException("只支持 HTTP 或 HTTPS");
            String method = "POST".equals(methodValue) ? "POST" : "GET";
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(45000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/json");
            if (apiKey != null && !apiKey.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + apiKey);
            if ("POST".equals(method)) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] payload = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) { output.write(payload); }
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
            StringBuilder responseBody = new StringBuilder();
            if (stream != null) try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                char[] buffer = new char[4096]; int count; int total = 0;
                while ((count = reader.read(buffer)) != -1 && total < 4_000_000) { responseBody.append(buffer, 0, count); total += count; }
            }
            result.put("ok", status >= 200 && status < 300);
            result.put("status", status);
            result.put("body", responseBody.toString());
            if (status < 200 || status >= 300) result.put("error", "API " + status);
        } catch (Exception error) {
            try { result.put("ok", false); result.put("error", error.getMessage() == null ? "连接失败" : error.getMessage()); } catch (Exception ignored) { }
        } finally { if (connection != null) connection.disconnect(); }
        return result.toString();
    }

    private void handleWebPermission(PermissionRequest request) {
        boolean wantsAudio = false, wantsVideo = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio = true;
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) wantsVideo = true;
        }
        if (!wantsAudio && !wantsVideo) { request.deny(); return; }
        boolean audioGranted = !wantsAudio || Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean videoGranted = !wantsVideo || Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        if (audioGranted && videoGranted) request.grant(request.getResources());
        else {
            pendingMediaRequest = request;
            java.util.ArrayList<String> permissions = new java.util.ArrayList<>();
            if (wantsAudio && !audioGranted) permissions.add(Manifest.permission.RECORD_AUDIO);
            if (wantsVideo && !videoGranted) permissions.add(Manifest.permission.CAMERA);
            requestPermissions(permissions.toArray(new String[0]), MEDIA_PERMISSION_REQUEST);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == MEDIA_PERMISSION_REQUEST && pendingMediaRequest != null) {
            boolean granted = results.length > 0;
            for (int result : results) if (result != PackageManager.PERMISSION_GRANTED) granted = false;
            if (granted) pendingMediaRequest.grant(pendingMediaRequest.getResources()); else pendingMediaRequest.deny();
            pendingMediaRequest = null;
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFileCallback = null;
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) { webView.onResume(); webView.evaluateJavascript("window.dispatchEvent(new Event('focus'))", null); }
    }

    @Override public void onBackPressed() { if (webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
    @Override protected void onPause() { if (webView != null) webView.onPause(); super.onPause(); }
    @Override protected void onDestroy() { networkExecutor.shutdownNow(); if (localModelController != null) localModelController.close(); if (webView != null) { webView.destroy(); webView = null; } super.onDestroy(); }

    private File modelDirectory() {
        File directory = new File(getFilesDir(), "models");
        if (!directory.exists()) directory.mkdirs();
        return directory;
    }

    private File safeModelFile(String fileName) {
        String safe = fileName == null ? "" : fileName.trim();
        if (!safe.matches("[A-Za-z0-9_.() -]{1,120}\\.gguf")) throw new IllegalArgumentException("模型文件名无效");
        return new File(modelDirectory(), safe);
    }

    private void downloadModel(String requestId, String urlValue, String fileName) {
        File target = null, partial = null;
        HttpURLConnection connection = null;
        try {
            target = safeModelFile(fileName);
            partial = new File(target.getParentFile(), target.getName() + ".part");
            if (target.isFile()) { sendModelEvent(requestId, true, "", target.length(), target.length()); return; }
            URL current = new URL(urlValue);
            long existingBytes = partial.isFile() ? partial.length() : 0;
            for (int redirect = 0; redirect < 6; redirect++) {
                if (!"https".equalsIgnoreCase(current.getProtocol())) throw new IllegalArgumentException("模型下载只允许 HTTPS");
                connection = (HttpURLConnection) current.openConnection();
                connection.setConnectTimeout(15000); connection.setReadTimeout(45000); connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("User-Agent", "NeoAI-Android/0.9.0");
                if (existingBytes > 0) connection.setRequestProperty("Range", "bytes=" + existingBytes + "-");
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location"); connection.disconnect(); connection = null;
                    if (location == null) throw new IOException("下载地址重定向无效");
                    current = new URL(current, location); continue;
                }
                if (status == 416 && existingBytes > 0) {
                    partial.delete(); existingBytes = 0; connection.disconnect(); connection = null; redirect--; continue;
                }
                if (status < 200 || status >= 300) throw new IOException("下载服务器返回 " + status);
                boolean resumed = status == 206 && existingBytes > 0;
                if (!resumed) existingBytes = 0;
                long remaining = connection.getContentLengthLong();
                long total = remaining > 0 ? existingBytes + remaining : -1;
                if (total > 5_500_000_000L) throw new IOException("模型超过 5.5 GB，当前版本不支持");
                if (remaining > 0 && modelDirectory().getUsableSpace() < remaining + 134_217_728L) throw new IOException("手机存储空间不足");
                byte[] buffer = new byte[64 * 1024]; long bytes = existingBytes, lastUpdate = 0;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial, resumed)) {
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count); bytes += count;
                        long now = System.currentTimeMillis(); if (now - lastUpdate > 400) { sendModelProgress(requestId, bytes, total); lastUpdate = now; }
                    }
                    output.getFD().sync();
                }
                if (total > 0 && bytes != total) throw new IOException("下载不完整");
                byte[] magic = new byte[4];
                try (FileInputStream check = new FileInputStream(partial)) { if (check.read(magic) != 4) throw new IOException("模型文件无效"); }
                if (magic[0] != 'G' || magic[1] != 'G' || magic[2] != 'U' || magic[3] != 'F') { partial.delete(); throw new IOException("下载内容不是 GGUF 模型"); }
                if (!partial.renameTo(target)) throw new IOException("模型保存失败");
                sendModelEvent(requestId, true, "", bytes, total); return;
            }
            throw new IOException("模型下载重定向过多");
        } catch (Exception error) {
            long saved = partial != null && partial.exists() ? partial.length() : 0;
            String message = error.getMessage() == null ? "下载失败" : error.getMessage();
            if (saved > 0) message += "；已保留进度，点击重试可继续";
            sendModelEvent(requestId, false, message, saved, 0);
        } finally { if (connection != null) connection.disconnect(); }
    }

    private void sendModelProgress(String requestId, long bytes, long total) {
        JSONObject event = new JSONObject();
        try { event.put("type", "progress"); event.put("bytes", bytes); event.put("total", total); } catch (Exception ignored) { }
        sendModelJavascript(requestId, event);
    }

    private void sendModelEvent(String requestId, boolean ok, String error, long bytes, long total) {
        JSONObject event = new JSONObject();
        try { event.put("type", "complete"); event.put("ok", ok); event.put("error", error); event.put("bytes", bytes); event.put("total", total); } catch (Exception ignored) { }
        sendModelJavascript(requestId, event);
    }

    private void sendModelJavascript(String requestId, JSONObject event) {
        modelDownloadStates.put(requestId, event.toString());
        runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.__neoaiModelEvent(" + JSONObject.quote(requestId) + "," + JSONObject.quote(event.toString()) + ")", null); });
    }

    private int bounded(int value, int min, int max) { return Math.max(min, Math.min(max, value)); }
    private String appPluginPackage(String id) {
        switch (id) {
            case "wechat": return "com.tencent.mm"; case "qq": return "com.tencent.mobileqq";
            case "douyin": return "com.ss.android.ugc.aweme"; case "kuaishou": return "com.smile.gifmaker";
            case "bilibili": return "tv.danmaku.bili"; case "xiaohongshu": return "com.xingin.xhs";
            case "taobao": return "com.taobao.taobao"; case "jd": return "com.jingdong.app.mall";
            case "alipay": return "com.eg.android.AlipayGphone"; case "meituan": return "com.sankuai.meituan";
            case "eleme": return "me.ele"; case "amap": return "com.autonavi.minimap";
            case "baidumap": return "com.baidu.BaiduMap"; case "doubao": return "com.larus.nova";
            case "deepseek": return "com.deepseek.chat"; case "wps": return "cn.wps.moffice_eng";
            default: throw new IllegalArgumentException("App 插件无效");
        }
    }
    private String safeText(String value, int max) { String text = value == null ? "" : value.trim(); return text.substring(0, Math.min(text.length(), max)); }
    private String safePhone(String value) { return safeText(value, 40).replaceAll("[^+0-9#*() \\-]", ""); }
}
