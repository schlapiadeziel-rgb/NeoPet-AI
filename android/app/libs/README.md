# Bundled Android inference runtime

`llama-android-release.aar` is built from the project's maintained llama.cpp fork at commit
`c4440c34e495c3a7a9c56d3d93c86f39fa6c9ba0`. It contains the arm64-v8a llama.cpp runtime
and the `com.arm.aichat` Kotlin facade. Model weights are never bundled in the APK; users
choose and download GGUF files from the in-app model center.

Upstream: https://github.com/ggml-org/llama.cpp

License: MIT. See `LLAMA_CPP_LICENSE.txt`.
