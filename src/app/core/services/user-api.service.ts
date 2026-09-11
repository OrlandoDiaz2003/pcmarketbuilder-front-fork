import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UpdateProfileRequest, UserResponse } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  /** Provisioning JIT: crear/sincronizar el usuario tras el primer login. */
  syncUser(): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.baseUrl}/users/sync`, {});
  }

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/users/me`);
  }

  updateMe(body: UpdateProfileRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.baseUrl}/users/me`, body);
  }
}
