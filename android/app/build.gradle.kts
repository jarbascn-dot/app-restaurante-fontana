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
versionCode = 2
versionName = "1.1.0"
}

buildTypes {
release {
isMinifyEnabled = false
}
}

compileOptions {
sourceCompatibility = JavaVersion.VERSION_1_8
targetCompatibility = JavaVersion.VERSION_1_8
}
}

dependencies {
implementation(platform("com.google.firebase:firebase-bom:34.15.0"))
implementation("com.google.firebase:firebase-messaging")
implementation("com.google.firebase:firebase-auth")
implementation("com.google.firebase:firebase-firestore")
implementation("androidx.appcompat:appcompat:1.7.0")
implementation("androidx.core:core-ktx:1.13.1")
}
