package com.wifiapp.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface ApiService {
    @POST("/api/auth/mobile-login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>
}

data class LoginRequest(val username: String, val password: String, val name: String, val macAddress: String?)
data class LoginResponse(val token: String, val device: DeviceInfo)
data class DeviceInfo(val id: String, val name: String)
