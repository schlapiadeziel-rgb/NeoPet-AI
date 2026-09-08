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
    private static final Pattern SENSITIVE_SCREEN = Pattern.compile("密码|验证码|转账|银行卡|信用卡|收银台|确认支付|立即支付|付款码|otp|password|payment password|bank card|credit card|checkout", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOCKED_CLICK = Pattern.compile("删除|卸载|支付|购买|下单|转账|发送|发布|上传|提交|确认付款|订阅|注销|erase|delete|uninstall|pay|buy|purchase|transfer|send|publish|upload|submit|subscribe", Pattern.CASE_INSENSITIVE);
    private static volatile NeoAIAccessibilityService instance;
    private static volatile String taskStatusJson = "{\"state\":\"idle\"}";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int runToken = 0;
    private String currentTaskId = "";
    private boolean taskRunning = false;

    public static boolean isRunning() { return instance != null; }

    public static boolean runSteps(JSONArray steps) {
        return runTask("sequence-" + System.currentTimeMillis(), steps);
    }

    public static boolean runTask(String taskId, JSONArray steps) {
        NeoAIAccessibilityService service = instance;
        if (service == null || service.taskRunning || taskId == null || taskId.isEmpty() || taskId.length() > 100 || steps == null || steps.length() == 0 || steps.length() > 32) return false;
        service.startTask(taskId, steps);
        return true;
    }

    public static String getTaskStatus() { return taskStatusJson; }

    public static boolean cancelTask(String taskId) {
        NeoAIAccessibilityService service = instance;
        if (service == null || !service.currentTaskId.equals(taskId)) return false;
        service.finishTask("cancelled", "任务已由用户停止", false);
        return true;
    }

    @Override protected void onServiceConnected() { super.onServiceConnected(); instance = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) { }
    @Override public void onInterrupt() { finishTask("failed", "跨 App 协助已中断", true); }
    @Override public void onDestroy() { if (taskRunning) finishTask("failed", "无障碍服务已关闭，任务中断", false); if (instance == this) instance = null; handler.removeCallbacksAndMessages(null); super.onDestroy(); }

    private void startTask(String taskId, JSONArray source) {
        final JSONArray steps;
        try { steps = new JSONArray(source.toString()); } catch (Exception error) { return; }
        handler.removeCallbacksAndMessages(null);
        currentTaskId = taskId;
        taskRunning = true;
        int token = ++runToken;
        updateTaskState("running", 0, steps.length(), "正在准备任务");
        executeStep(steps, 0, token, 0);
    }

    private void executeStep(JSONArray steps, int index, int token, int attempt) {
        if (token != runToken) return;
        if (index >= steps.length()) {
            finishTask("complete", "长任务已完成", true);
            return;
        }
        try {
            JSONObject step = steps.getJSONObject(index);
            String action = step.optString("action");
            updateTaskState("running", index + 1, steps.length(), stepLabel(action, step, attempt));
            if (!"open_app".equals(action) && isSensitiveScreen()) { finishTask("failed", "检测到敏感界面，NeoAI 已停止操作", true); return; }
            boolean complete = true;
            long delay = 650;
            switch (action) {
                case "open_app": complete = openKnownApp(step.optString("app")); delay = 1600; break;
                case "click_text": complete = clickAnyText(step); break;
                case "input_text": complete = inputText(step.optString("text")); break;
                case "scroll_forward": complete = scroll(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD); break;
                case "scroll_backward": complete = scroll(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD); break;
                case "wait_for_text": complete = hasAnyText(step); delay = 450; break;
                case "back": complete = performGlobalAction(GLOBAL_ACTION_BACK); break;
                case "home": complete = performGlobalAction(GLOBAL_ACTION_HOME); break;
                case "wait": delay = Math.max(200, Math.min(5000, step.optLong("milliseconds", 800))); break;
                default: complete = false;
            }
            if (!complete) {
                int maxAttempts = "wait_for_text".equals(action) ? 12 : 4;
                if (attempt + 1 < maxAttempts) { handler.postDelayed(() -> executeStep(steps, index, token, attempt + 1), delay); return; }
                finishTask("failed", "第 " + (index + 1) + " 步找不到目标或无法安全执行", true); return;
            }
            handler.postDelayed(() -> executeStep(steps, index + 1, token, 0), delay);
        } catch (Exception error) { finishTask("failed", "操作步骤无效，NeoAI 已停止", true); }
    }

    private String stepLabel(String action, JSONObject step, int attempt) {
        String label;
        switch (action) { case "open_app": label = "打开 " + step.optString("app"); break; case "click_text": label = "查找并点击"; break; case "input_text": label = "填写内容"; break; case "wait_for_text": label = "等待界面出现"; break; case "scroll_forward": label = "向下滚动"; break; case "scroll_backward": label = "向上滚动"; break; case "back": label = "返回"; break; case "home": label = "回到桌面"; break; default: label = "等待"; }
        return attempt > 0 ? label + "（重试 " + attempt + "）" : label;
    }

    private void updateTaskState(String state, int step, int total, String message) {
        JSONObject value = new JSONObject();
        try { value.put("taskId", currentTaskId); value.put("state", state); value.put("step", step); value.put("total", total); value.put("message", message); value.put("updatedAt", System.currentTimeMillis()); } catch (Exception ignored) { }
        taskStatusJson = value.toString();
    }

    private void finishTask(String state, String message, boolean toast) {
        runToken++; taskRunning = false; handler.removeCallbacksAndMessages(null); updateTaskState(state, 0, 0, message);
        if (toast) Toast.makeText(this, message, Toast.LENGTH_LONG).show();
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

    private boolean clickAnyText(JSONObject step) {
        JSONArray alternatives = step.optJSONArray("texts");
        if (alternatives != null) for (int index = 0; index < Math.min(5, alternatives.length()); index++) if (clickText(alternatives.optString(index))) return true;
        return clickText(step.optString("text"));
    }

    private boolean hasAnyText(JSONObject step) {
        JSONArray alternatives = step.optJSONArray("texts");
        if (alternatives != null) for (int index = 0; index < Math.min(5, alternatives.length()); index++) if (hasText(alternatives.optString(index))) return true;
        return hasText(step.optString("text"));
    }

    private boolean hasText(String text) {
        String value = safeText(text, 80);
        if (value.isEmpty() || SENSITIVE_SCREEN.matcher(value).find()) return false;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        return root != null && !root.findAccessibilityNodeInfosByText(value).isEmpty();
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
