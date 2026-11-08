plugins { id("com.android.application") }

android {
    namespace = "io.github.itsnold.fcdroid"
    compileSdk = 35
    defaultConfig {
        applicationId = "io.github.itsnold.fcdroid"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-alpha"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    androidResources { noCompress += "wasm" }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/assets"))
    sourceSets["main"].res.srcDir(layout.buildDirectory.dir("generated/icon-res"))
}

// Reuse FilmCraft's MIT/Apache-2.0 app icon, not the restricted docs/brand marks.
// Generate a resource copy instead of keeping a second binary asset in source control.
val bundleLauncherIcon by tasks.registering(Sync::class) {
    val icon = rootProject.file("../../assets/app-icon/filmcraft-1024.png")
    doFirst { check(icon.isFile) { "Missing licensed FilmCraft launcher artwork: $icon" } }
    into(layout.buildDirectory.dir("generated/icon-res"))
    from(rootProject.file("launcher-res")) { exclude("**/*.attribution") }
    from(icon) { into("drawable-nodpi"); rename { "filmcraft_icon.png" } }
}

// Always package the editor built from THIS checkout, never a remote website or release zip.
val webDist = providers.gradleProperty("webDist").orElse("../../../target/web/dist")
val bundleEditor by tasks.registering(Sync::class) {
    val dist = file(webDist.get())
    doFirst {
        check(dist.resolve("filmcraft_web_bg.wasm").isFile) {
            "Missing web build: run `cargo xtask web` at the repository root first (or -PwebDist=/absolute/dist)."
        }
    }
    into(layout.buildDirectory.dir("generated/assets"))
    from(dist) { into("editor") }
    from(rootProject.file("../../")) {
        include("LICENSE-MIT", "LICENSE-APACHE", "NOTICE", "ATTRIBUTION.md")
        into("editor/licenses")
    }
    from(rootProject.file("../../assets")) {
        include("**/LICENSE*", "**/OFL*", "**/*.attribution")
        into("editor/licenses/assets")
    }
    from(rootProject.file("launcher-res")) {
        include("**/*.attribution")
        into("editor/licenses/android-launcher")
    }
}
tasks.named("preBuild") { dependsOn(bundleEditor, bundleLauncherIcon) }

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
