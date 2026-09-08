package ai.neopet.mobile;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public class NeoAIAccessibilityService extends AccessibilityService {
    private static final Pattern SENSITIVE_SCREEN = Pattern.compile("密码|验证码|支付|转账|银行卡|信用卡|otp|password|payment|bank|credit card", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOCKED_CLICK = Pattern.compile("删除|卸载|支付|购买|下单|转账|发送|发布|上传|提交|确认付款|订阅|注销|erase|delete|uninstall|pay|buy|purchase|transfer|send|publish|upload|submit|subscribe", Pattern.CASE_INSENSITIVE);
    private static volatile NeoAIAccessibilityService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int runToken = 0;

    public static boolean isRunning() { return instance != null; }

    public static boolean runSteps(JSONArray steps) {
        NeoAIAccessibilityService service = instance;
        if (service == null || steps == null || steps.length() == 0 || steps.length() > 8) return false;
        service.startSequence(steps);
        return true;
    }

    @Override protected void onServiceConnected() { super.onServiceConnected(); instance = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) { }
    @Override public void onInterrupt() { stopSequence("跨 App 协助已中断"); }
    @Override public void onDestroy() { if (instance == this) instance = null; handler.removeCallbacksAndMessages(null); super.onDestroy(); }

    private void startSequence(JSONArray source) {
        final JSONArray steps;
        try { steps = new JSONArray(source.toString()); } catch (Exception error) { return; }
        int token = ++runToken;
        executeStep(steps, 0, token);
    }

    private void executeStep(JSONArray steps, int index, int token) {
        if (token != runToken || index >= steps.length()) {
            if (token == runToken) Toast.makeText(this, "NeoAI 跨 App 操作已完成", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            JSONObject step = steps.getJSONObject(index);
            String action = step.optString("action");
            if (!"open_app".equals(action) && isSensitiveScreen()) { stopSequence("检测到敏感界面，NeoAI 已停止操作"); return; }
            boolean complete = true;
            long delay = 650;
            switch (action) {
                case "open_app": complete = openKnownApp(step.optString("app")); delay = 1200; break;
                case "click_text": complete = clickText(step.optString("text")); break;
                case "input_text": complete = inputText(step.optString("text")); break;
                case "scroll_forward": complete = scroll(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD); break;
                case "scroll_backward": complete = scroll(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD); break;
                case "back": complete = performGlobalAction(GLOBAL_ACTION_BACK); break;
                case "home": complete = performGlobalAction(GLOBAL_ACTION_HOME); break;
                case "wait": delay = Math.max(200, Math.min(5000, step.optLong("milliseconds", 800))); break;
                default: complete = false;
            }
            if (!complete) { stopSequence("有一步无法安全执行，NeoAI 已停止"); return; }
            handler.postDelayed(() -> executeStep(steps, index + 1, token), delay);
        } catch (Exception error) { stopSequence("操作步骤无效，NeoAI 已停止"); }
    }

    private boolean openKnownApp(String app) {
        Intent intent;
        switch (app) {
            case "browser": intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")); break;
            case "email": intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_EMAIL); break;
            case "maps": intent = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=")); break;
            case "music": intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_MUSIC); break;
            case "calendar": intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_CALENDAR); break;
            case "contacts": intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_CONTACTS); break;
            case "calculator": intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_CALCULATOR); break;
            case "files": intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"); break;
            case "gallery": intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_GALLERY); break;
            case "camera": intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE); break;
            case "settings": intent = new Intent(Settings.ACTION_SETTINGS); break;
            default: {
                String packageName = appPluginPackage(app);
                if (packageName == null) return false;
                intent = getPackageManager().getLaunchIntentForPackage(packageName);
                if (intent == null) return false;
            }
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (intent.resolveActivity(getPackageManager()) == null) return false;
        startActivity(intent);
        return true;
    }

    private boolean clickText(String text) {
        String value = safeText(text, 80);
        if (value.isEmpty() || BLOCKED_CLICK.matcher(value).find()) return false;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(value);
        for (AccessibilityNodeInfo node : nodes) {
            AccessibilityNodeInfo target = node;
            for (int depth = 0; target != null && depth < 5; depth++) {
                if (target.isVisibleToUser() && target.isClickable()) return target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                target = target.getParent();
            }
        }
        return false;
    }

    private boolean inputText(String text) {
        String value = safeText(text, 500);
        if (value.isEmpty() || SENSITIVE_SCREEN.matcher(value).find()) return false;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo focused = root == null ? null : root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (focused == null || !focused.isEditable() || focused.isPassword()) return false;
        Bundle arguments = new Bundle();
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value);
        return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
    }

    private boolean scroll(int action) {
        AccessibilityNodeInfo node = getRootInActiveWindow();
        for (int depth = 0; node != null && depth < 12; depth++) {
            if (node.isScrollable()) return node.performAction(action);
            AccessibilityNodeInfo next = null;
            for (int index = 0; index < node.getChildCount(); index++) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null && child.isScrollable()) { next = child; break; }
            }
            node = next;
        }
        return false;
    }

    private boolean isSensitiveScreen() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        return containsSensitiveText(root, 0, new int[]{0});
    }

    private boolean containsSensitiveText(AccessibilityNodeInfo node, int depth, int[] seen) {
        if (node == null || depth > 12 || seen[0]++ > 240) return false;
        CharSequence text = node.getText();
        CharSequence description = node.getContentDescription();
        if ((text != null && SENSITIVE_SCREEN.matcher(text).find()) || (description != null && SENSITIVE_SCREEN.matcher(description).find()) || node.isPassword()) return true;
        for (int index = 0; index < node.getChildCount(); index++) if (containsSensitiveText(node.getChild(index), depth + 1, seen)) return true;
        return false;
    }

    private void stopSequence(String reason) { runToken++; handler.removeCallbacksAndMessages(null); Toast.makeText(this, reason, Toast.LENGTH_LONG).show(); }
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
            default: return null;
        }
    }
    private String safeText(String value, int max) { String text = value == null ? "" : value.trim(); return text.substring(0, Math.min(text.length(), max)); }
}
