package ai.neopet.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;

import java.io.IOException;
import java.io.InputStream;

public class OverlayPetService extends Service {
    public static final String ACTION_STOP = "ai.neopet.mobile.STOP_OVERLAY";
    private static final String CHANNEL_ID = "neopet_overlay";
    private static final int NOTIFICATION_ID = 1101;
    private static volatile boolean running;

    private WindowManager windowManager;
    private WindowManager.LayoutParams layoutParams;
    private PetOverlayView petView;
    private String selectedPetId = "xiaonuo";
    private String selectedPetName = "小诺";

    public static boolean isRunning() {
        return running;
    }

    @Override public void onCreate() {
        super.onCreate();
        selectedPetId = getSharedPreferences("neopet", MODE_PRIVATE).getString("pet_id", "xiaonuo");
        if (selectedPetId == null || !selectedPetId.matches("[a-z0-9-]{1,40}")) selectedPetId = "xiaonuo";
        selectedPetName = displayName(selectedPetId);
        createNotificationChannel();
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        if (Build.VERSION.SDK_INT < 23 || !Settings.canDrawOverlays(this)) {
            stopSelf();
            return;
        }
        showOverlay();
        running = true;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "小诺悬浮桌宠",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("让小诺在其他应用上方陪伴你");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
            this, 1, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent stopIntent = new Intent(this, OverlayPetService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
            this, 2, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(R.drawable.ic_pet_notification)
            .setContentTitle(selectedPetName + "正在陪伴你")
            .setContentText("点击打开聊天；拖动小诺可以移动位置")
            .setContentIntent(openPending)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .addAction(new Notification.Action.Builder(null, "关闭桌宠", stopPending).build())
            .build();
    }

    private void showOverlay() {
        Bitmap atlas;
        try (InputStream input = getAssets().open("assets/pets/" + selectedPetId + "/spritesheet.webp")) {
            atlas = BitmapFactory.decodeStream(input);
        } catch (IOException error) {
            stopSelf();
            return;
        }
        if (atlas == null) {
            stopSelf();
            return;
        }

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        layoutParams = new WindowManager.LayoutParams(
            dp(280),
            dp(330),
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        layoutParams.x = Math.max(dp(12), getResources().getDisplayMetrics().widthPixels - dp(292));
        layoutParams.y = dp(110);
        petView = new PetOverlayView(this, atlas);
        petView.setActions(new PetOverlayView.Actions() {
            @Override public void move(int startX, int startY, float dx, float dy) {
                int screenWidth = getResources().getDisplayMetrics().widthPixels;
                int screenHeight = getResources().getDisplayMetrics().heightPixels;
                int keepVisible = dp(64);
                int nextX = startX + Math.round(dx);
                int nextY = startY + Math.round(dy);
                layoutParams.x = Math.max(-layoutParams.width + keepVisible, Math.min(nextX, screenWidth - keepVisible));
                layoutParams.y = Math.max(0, Math.min(nextY, screenHeight - keepVisible));
                if (windowManager != null && petView != null) windowManager.updateViewLayout(petView, layoutParams);
            }

            @Override public void open(boolean startVoice) {
                openApp(startVoice);
            }
        });
        windowManager.addView(petView, layoutParams);
    }

    private String displayName(String petId) {
        if ("yuntuan".equals(petId)) return "云团";
        if ("yueli".equals(petId)) return "月狸";
        return "小诺";
    }

    private void openApp(boolean startVoice) {
        Intent intent = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("start_voice", startVoice);
        startActivity(intent);
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override public void onDestroy() {
        running = false;
        if (petView != null) petView.stop();
        if (windowManager != null && petView != null) {
            try { windowManager.removeView(petView); } catch (Exception ignored) { }
        }
        petView = null;
        stopForeground(true);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) {
        return null;
    }

    private static final class PetOverlayView extends View {
        interface Actions {
            void move(int startX, int startY, float dx, float dy);
            void open(boolean startVoice);
        }

        private final Bitmap atlas;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final Paint controlPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Handler handler = new Handler(Looper.getMainLooper());
        private Actions actions;
        private int row;
        private int frame;
        private int frames = 6;
        private long interval = 480;
        private float downRawX;
        private float downRawY;
        private int startWindowX;
        private int startWindowY;
        private boolean dragging;
        private final Runnable animate = new Runnable() {
            @Override public void run() {
                frame = (frame + 1) % frames;
                invalidate();
                handler.postDelayed(this, interval);
            }
        };
        private final Runnable returnIdle = () -> play(0, 6, 480, 0);

        PetOverlayView(Context context, Bitmap atlas) {
            super(context);
            this.atlas = atlas;
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            handler.post(animate);
        }

        void setActions(Actions actions) {
            this.actions = actions;
        }

        private float dp(float value) {
            return value * getResources().getDisplayMetrics().density;
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int cellWidth = atlas.getWidth() / 8;
            int cellHeight = atlas.getHeight() / 11;
            Rect source = new Rect(frame * cellWidth, row * cellHeight, (frame + 1) * cellWidth, (row + 1) * cellHeight);
            float petWidth = dp(210);
            float petHeight = dp(228);
            float left = (getWidth() - petWidth) / 2f;
            RectF destination = new RectF(left, dp(8), left + petWidth, dp(8) + petHeight);
            paint.setShadowLayer(dp(13), 0, dp(9), 0x55000000);
            canvas.drawBitmap(atlas, source, destination, paint);
            paint.clearShadowLayer();

            float centerY = dp(282);
            float leftX = getWidth() / 2f - dp(34);
            float rightX = getWidth() / 2f + dp(34);
            controlPaint.setStyle(Paint.Style.FILL);
            controlPaint.setColor(0xDD16131F);
            controlPaint.setShadowLayer(dp(9), 0, dp(5), 0x55000000);
            canvas.drawCircle(leftX, centerY, dp(22), controlPaint);
            canvas.drawCircle(rightX, centerY, dp(22), controlPaint);
            controlPaint.clearShadowLayer();
            controlPaint.setStyle(Paint.Style.STROKE);
            controlPaint.setStrokeWidth(dp(1));
            controlPaint.setColor(0x55FFFFFF);
            canvas.drawCircle(leftX, centerY, dp(22), controlPaint);
            canvas.drawCircle(rightX, centerY, dp(22), controlPaint);
            controlPaint.setStrokeWidth(dp(2));
            controlPaint.setStrokeCap(Paint.Cap.ROUND);
            controlPaint.setColor(Color.WHITE);
            for (int i = -2; i <= 2; i++) {
                float height = dp(i == 0 ? 12 : Math.abs(i) == 1 ? 8 : 5);
                float x = leftX + dp(i * 4);
                canvas.drawLine(x, centerY - height / 2, x, centerY + height / 2, controlPaint);
            }
            canvas.drawLine(rightX - dp(6), centerY + dp(3), rightX, centerY - dp(4), controlPaint);
            canvas.drawLine(rightX, centerY - dp(4), rightX + dp(6), centerY + dp(3), controlPaint);
        }

        @Override public boolean onTouchEvent(MotionEvent event) {
            if (actions == null) return false;
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downRawX = event.getRawX();
                    downRawY = event.getRawY();
                    OverlayPetService service = (OverlayPetService) getContext();
                    startWindowX = service.layoutParams.x;
                    startWindowY = service.layoutParams.y;
                    dragging = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - downRawX;
                    float dy = event.getRawY() - downRawY;
                    if (!dragging && Math.abs(dx) + Math.abs(dy) > dp(7)) dragging = true;
                    if (dragging) actions.move(startWindowX, startWindowY, dx, dy);
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!dragging) handleTap(event.getX(), event.getY());
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    return true;
                default:
                    return super.onTouchEvent(event);
            }
        }

        private void handleTap(float x, float y) {
            float centerY = dp(282);
            float leftX = getWidth() / 2f - dp(34);
            float rightX = getWidth() / 2f + dp(34);
            if (distance(x, y, leftX, centerY) <= dp(28)) {
                play(6, 6, 220, 1800);
                actions.open(true);
            } else if (distance(x, y, rightX, centerY) <= dp(28)) {
                actions.open(false);
            } else if (y <= dp(250)) {
                play(4, 5, 135, 2100);
            }
        }

        private float distance(float x1, float y1, float x2, float y2) {
            float dx = x1 - x2;
            float dy = y1 - y2;
            return (float) Math.sqrt(dx * dx + dy * dy);
        }

        private void play(int nextRow, int nextFrames, long nextInterval, long duration) {
            handler.removeCallbacks(animate);
            handler.removeCallbacks(returnIdle);
            row = nextRow;
            frames = nextFrames;
            interval = nextInterval;
            frame = 0;
            invalidate();
            handler.postDelayed(animate, interval);
            if (duration > 0) handler.postDelayed(returnIdle, duration);
        }

        void stop() {
            handler.removeCallbacksAndMessages(null);
        }
    }
}
