export const environment = {
  production: false,
  bffBaseUrl: 'http://localhost:4000/api',
  msal: {
    // Azure Entra ID (Azure AD) App Registration — plataforma "Single-page application".
    // Reemplazar con los valores reales del tenant. Ver README para los pasos de alta.
    clientId: '6c2342af-22f6-4de8-a545-2a3b04e7d1ff',
    tenantId: '35365687-614a-481c-8b8b-b4debee24880',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200',
  },
};

