package ai.neopet.mobile

import android.content.Context
import com.arm.aichat.AiChat
import com.arm.aichat.InferenceEngine
import java.io.File
import java.util.function.BiConsumer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Thin, serialized adapter between the WebView UI and the bundled llama.cpp Android runtime. */
class LocalModelController(context: Context) {
    private val engine = AiChat.getInferenceEngine(context.applicationContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private var loadedModel = ""

    fun generate(modelFile: File, systemPrompt: String, conversation: String, callback: BiConsumer<String?, String?>) {
        scope.launch {
            try {
                val reply = mutex.withLock {
                    val initial = engine.state.first {
                        it is InferenceEngine.State.Initialized ||
                            it is InferenceEngine.State.ModelReady ||
                            it is InferenceEngine.State.Error
                    }
                    if (initial is InferenceEngine.State.Error) engine.cleanUp()
                    if (loadedModel != modelFile.absolutePath || engine.state.value !is InferenceEngine.State.ModelReady) {
                        if (engine.state.value is InferenceEngine.State.ModelReady) engine.cleanUp()
                        engine.loadModel(modelFile.absolutePath)
                        engine.setSystemPrompt(systemPrompt)
                        loadedModel = modelFile.absolutePath
                    } else {
                        engine.resetConversation(systemPrompt)
                    }
                    val answer = StringBuilder()
                    engine.sendUserPrompt(conversation, 512).collect { answer.append(it) }
                    answer.toString()
                        .replace(Regex("(?s)<think>.*?(?:</think>|$)\\s*"), "")
                        .trim()
                }
                callback.accept(reply, null)
            } catch (error: Throwable) {
                val detail = error.message?.takeIf { it.isNotBlank() } ?: error.javaClass.simpleName
                callback.accept(null, "本机推理失败：$detail")
            }
        }
    }

    fun close() {
        scope.cancel()
        try { engine.destroy() } catch (_: Throwable) { }
    }
}
