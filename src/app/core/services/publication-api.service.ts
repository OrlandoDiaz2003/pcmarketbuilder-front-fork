import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddImageRequest,
  CreateListingRequest,
  PresignedUrlResponse,
  Publication,
} from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class PublicationApiService {
  private readonly baseUrl = environment.bffBaseUrl;

  constructor(private readonly http: HttpClient) {}

  createListing(body: CreateListingRequest): Observable<Publication> {
    // La identidad (X-User-Id/X-User-Role) la deriva el BFF del Bearer token
    // que agrega MsalInterceptor; el cliente no la manda.
    return this.http.post<Publication>(`${this.baseUrl}/listings`, body);
  }

  getPresignedUrl(
    publicationId: string,
    fileName: string,
    contentType: string,
  ): Observable<PresignedUrlResponse> {
    return this.http.post<PresignedUrlResponse>(
      `${this.baseUrl}/listings/${publicationId}/images/presigned-url`,
      { fileName, contentType },
    );
  }

  async uploadImageToS3(uploadUrl: string, file: File): Promise<void> {
    // Se usa fetch nativo para enviar el binario directamente a S3
    // sin pasar por interceptores de autenticación de Angular ni tocar el BFF
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Error al subir imagen a S3: ${response.status} ${response.statusText}`);
    }
  }

  registerImage(
    publicationId: string,
    imageUrl: string,
    isPrimary: boolean = false,
  ): Observable<Publication> {
    const body: AddImageRequest = { imageUrl, isPrimary };
    return this.http.post<Publication>(
      `${this.baseUrl}/listings/${publicationId}/images`,
      body,
    );
  }

  deleteImage(publicationId: string, imageId: string): Observable<Publication> {
    return this.http.delete<Publication>(
      `${this.baseUrl}/listings/${publicationId}/images/${imageId}`,
    );
  }

  setPrimaryImage(publicationId: string, imageId: string): Observable<Publication> {
    return this.http.patch<Publication>(
      `${this.baseUrl}/listings/${publicationId}/images/${imageId}/primary`,
      {},
    );
  }

  /**
   * Sube una lista de archivos a S3 y los registra en la publicación.
   * La primera foto se marca como primaria si la publicación aún no tiene fotos.
   */
  async uploadAndRegisterImages(
    publicationId: string,
    files: File[],
    firstIsPrimary: boolean = true,
  ): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const presigned = await firstValueFrom(
        this.getPresignedUrl(publicationId, file.name, file.type),
      );
      await this.uploadImageToS3(presigned.uploadUrl, file);
      await firstValueFrom(
        this.registerImage(publicationId, presigned.fileUrl, firstIsPrimary && i === 0),
      );
    }
  }
}
