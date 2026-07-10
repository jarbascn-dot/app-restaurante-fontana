plugins {
id("com.android.application")
id("org.jetbrains.kotlin.android")
id("com.google.gms.google-services")
}

android {
namespace = "com.fontana.sgr"
compileSdk = 35

defaultConfig {
applicationId = "com.fontana.sgr"
minSdk = 26
targetSdk = 35
versionCode = 4
    versionName = "1.1.2"
}

signingConfigs {
create("release") {
val ksFile = System.getenv("KEYSTORE_FILE")
if (ksFile != null) {
storeFile = file(ksFile)
storePassword = System.getenv("KEYSTORE_PASSWORD")
keyAlias = System.getenv("KEY_ALIAS")
keyPassword = System.getenv("KEY_PASSWORD")
}
}
}

buildTypes {
release {
isMinifyEnabled = false
signingConfig = signingConfigs.getByName("release")
}
}

compileOptions {
sourceCompatibility = JavaVersion.VERSION_17
targetCompatibility = JavaVersion.VERSION_17
}

kotlinOptions {
jvmTarget = "17"
}
}

dependencies {
implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
implementation("com.google.firebase:firebase-messaging")
implementation("com.google.firebase:firebase-auth")
implementation("com.google.firebase:firebase-firestore")
implementation("androidx.appcompat:appcompat:1.7.0")
implementation("androidx.core:core-ktx:1.13.1")
}
