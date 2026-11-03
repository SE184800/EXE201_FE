package com.supplymind.mobile;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.widget.Toast;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/** One user-initiated utterance at a time; never records in the background. */
@CapacitorPlugin(name = "SupplyMindSpeech", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class SupplyMindSpeechPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall active;
    private Runnable deadline;

    @Override
    public void load() {
        // Also works with the currently hosted FE: its Web Speech calls use this adapter.
        bridge.injectScriptBeforeLoad("supplymind-speech.js");
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void listen(PluginCall call) {
        main.post(() -> {
            Uri page = Uri.parse(bridge.getWebView().getUrl() == null ? "" : bridge.getWebView().getUrl());
            if (!"https".equals(page.getScheme()) || !"supplymind-demo.vercel.app".equals(page.getHost())) {
                call.reject("Chỉ có thể dùng mic trong SupplyMind.", "not-allowed");
                return;
            }
            if (active != null) {
                call.reject("Mic đang được sử dụng.", "audio-capture");
                return;
            }
            active = call;
            call.setKeepAlive(true);
            setDeadline(45000);
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                requestPermissionForAlias("microphone", call, "microphoneResult");
            } else {
                begin(call);
            }
        });
    }

    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        main.post(() -> {
            if (active != call) return;
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                fail("not-allowed", "Chưa được cấp quyền mic. Vào Cài đặt → Ứng dụng → SupplyMind AI → Quyền → Micro.");
            } else {
                begin(call);
            }
        });
    }

    private void begin(PluginCall call) {
        try {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                fail("service-not-allowed", "Điện thoại chưa có dịch vụ nhận giọng nói. Kiểm tra dịch vụ giọng nói trong Cài đặt.");
                return;
            }
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                private boolean current() { return active == call; }
                @Override public void onReadyForSpeech(Bundle params) {
                    if (!current()) return;
                    setDeadline(20000);
                    call.resolve(new JSObject().put("type", "start"));
                }
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {
                    if (!current()) return;
                    setDeadline(10000);
                    call.resolve(new JSObject().put("type", "audioend"));
                }
                @Override public void onError(int error) {
                    if (!current()) return;
                    switch (error) {
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                            fail("not-allowed", "Chưa được cấp quyền mic cho SupplyMind AI."); break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                            fail("network", "Không kết nối được dịch vụ giọng nói. Kiểm tra mạng rồi thử lại."); break;
                        case SpeechRecognizer.ERROR_NO_MATCH:
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                            fail("no-speech", "Chưa nghe rõ. Thử nói tên hàng rồi số lượng, ví dụ Coca 2."); break;
                        case SpeechRecognizer.ERROR_AUDIO:
                        case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                            fail("audio-capture", "Không mở được mic. Đóng ứng dụng đang dùng mic rồi thử lại."); break;
                        default:
                            fail("service-not-allowed", "Dịch vụ giọng nói chưa sẵn sàng (" + error + "). Hãy thử lại.");
                    }
                }
                @Override public void onResults(Bundle results) {
                    if (!current()) return;
                    ArrayList<String> matches = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String transcript = matches == null || matches.isEmpty() ? "" : matches.get(0).trim();
                    if (transcript.isEmpty()) {
                        fail("no-speech", "Chưa nghe rõ. Hãy thử nói lại.");
                        return;
                    }
                    PluginCall completed = clear();
                    completed.setKeepAlive(false);
                    completed.resolve(new JSObject().put("type", "result").put("transcript", transcript));
                }
                @Override public void onPartialResults(Bundle results) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "vi-VN"));
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            setDeadline(10000);
            recognizer.startListening(intent);
        } catch (SecurityException ex) {
            fail("not-allowed", "Không có quyền sử dụng mic. Kiểm tra quyền của SupplyMind AI.");
        } catch (RuntimeException ex) {
            fail("audio-capture", "Không khởi động được nhận giọng nói. Hãy thử lại.");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (matches(call) && recognizer != null) {
                try {
                    setDeadline(10000);
                    recognizer.stopListening();
                } catch (RuntimeException ex) {
                    fail("audio-capture", "Không lấy được kết quả giọng nói. Hãy thử lại.");
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        main.post(() -> {
            if (matches(call)) fail("aborted", "Đã dừng nghe.");
            call.resolve();
        });
    }

    private boolean matches(PluginCall call) {
        String session = call.getString("sessionId");
        return active != null && session != null && session.equals(active.getString("sessionId"));
    }

    private void setDeadline(long millis) {
        if (deadline != null) main.removeCallbacks(deadline);
        deadline = () -> fail("no-speech", "Hết thời gian chờ giọng nói. Bấm mic để thử lại.");
        main.postDelayed(deadline, millis);
    }

    private PluginCall clear() {
        PluginCall previous = active;
        active = null;
        if (deadline != null) main.removeCallbacks(deadline);
        deadline = null;
        if (recognizer != null) {
            SpeechRecognizer previousRecognizer = recognizer;
            recognizer = null;
            previousRecognizer.cancel();
            previousRecognizer.destroy();
        }
        return previous;
    }

    private void fail(String code, String message) {
        if (active == null) return;
        PluginCall failed = clear();
        failed.setKeepAlive(false);
        failed.reject(message, code);
        // The hosted FE may still have its old generic error handler.
        if (!"aborted".equals(code)) Toast.makeText(getContext(), message, Toast.LENGTH_LONG).show();
    }

    @Override protected void handleOnStop() {
        main.post(() -> fail("aborted", "Đã dừng nghe khi rời ứng dụng."));
    }

    @Override protected void handleOnDestroy() {
        main.post(() -> fail("aborted", "Đã đóng nhận giọng nói."));
    }
}
