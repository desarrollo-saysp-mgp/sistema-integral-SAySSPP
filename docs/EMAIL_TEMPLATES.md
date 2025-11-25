# Email Templates Configuration

This document explains how to configure Spanish email templates in Supabase for the invitation system.

## Overview

When an admin creates a new user, the system automatically sends an invitation email using Supabase's `inviteUserByEmail()` function. The default templates are in English and need to be customized to Spanish.

## Configuring Email Templates in Supabase

### 1. Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Email Templates**

### 2. Customize the Invite User Template

Select the **Invite user** template and replace it with the following Spanish version:

#### Subject Line
```
Invitación al Sistema de Gestión de Reclamos
```

#### Email Body (HTML)
```html
<h2>Bienvenido al Sistema de Gestión de Reclamos</h2>

<p>Hola,</p>

<p>Has sido invitado a unirte al Sistema de Gestión de Reclamos de la municipalidad.</p>

<p>Para configurar tu contraseña y acceder al sistema, haz clic en el siguiente enlace:</p>

<p>
  <a href="{{ .ConfirmationURL }}">Configurar mi contraseña</a>
</p>

<p>Si no puedes hacer clic en el enlace, copia y pega la siguiente URL en tu navegador:</p>

<p>{{ .ConfirmationURL }}</p>

<p><strong>Importante:</strong> Este enlace expirará en 24 horas.</p>

<p>Si no solicitaste esta invitación, puedes ignorar este correo.</p>

<p>
  Saludos,<br/>
  Sistema de Gestión de Reclamos
</p>
```

### 3. Test the Template

After saving the template:

1. Create a test user from `/admin/users`
2. Check that the invitation email arrives in the correct format
3. Verify that the confirmation link works properly

## Environment Variables

Make sure the following environment variable is set correctly in your `.env.local` and Vercel environment:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

This ensures that the redirect URL after password setup points to the correct domain.

## How User Creation Works

### Admin Perspective: Creating a New User

1. **Navigate to User Management**
   - Admin logs in with Admin role
   - Goes to `/admin/users`

2. **Click "Crear Usuario" Button**
   - Opens dialog form

3. **Fill User Information**
   - **Nombre completo**: User's full name (e.g., "María González")
   - **Email**: User's email address (e.g., "maria@municipalidad.gob.ar")
   - **Rol**: Select either "Admin" or "Administrative"
   - **Note**: No password field - users set their own passwords

4. **Submit Form**
   - Click "Crear" button
   - System creates user account in Supabase Auth
   - System creates user profile in `users` table
   - System automatically sends invitation email
   - Success message appears

5. **User Appears in List**
   - New user shown in users table
   - Status: "Invited" (pending password setup)

### Technical Flow (Behind the Scenes)

1. **Admin submits form** → `POST /api/users`
   ```json
   {
     "full_name": "María González",
     "email": "maria@municipalidad.gob.ar",
     "role": "Administrative"
   }
   ```

2. **API validates request**
   - Checks admin authentication
   - Validates required fields
   - Validates role value

3. **System invites user**
   ```javascript
   await supabase.auth.admin.inviteUserByEmail(email, {
     redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
   })
   ```

4. **Supabase creates auth account**
   - Creates user in `auth.users` table
   - Generates unique user ID
   - Sets email as confirmed
   - Generates invitation token

5. **System creates profile**
   ```javascript
   await supabase.from('users').insert({
     id: newAuthUser.user.id,
     full_name: "María González",
     email: "maria@municipalidad.gob.ar",
     role: "Administrative"
   })
   ```

6. **Supabase sends invitation email**
   - Uses configured Spanish template
   - Includes magic link with token
   - Link format: `https://your-project.supabase.co/auth/v1/verify?token=...&type=invite&redirect_to=...`

### User Perspective: Receiving Invitation

1. **Receives Email**
   - Subject: "Invitación al Sistema de Gestión de Reclamos"
   - From: Supabase (configured sender)
   - Contains welcome message and "Configurar mi contraseña" button

2. **Clicks Invitation Link**
   - Link opens in browser
   - Supabase validates invitation token
   - Shows password setup page

3. **Sets Password**
   - User enters new password (minimum 6 characters)
   - Confirms password
   - Submits form

4. **Account Activated**
   - Supabase updates user account with password hash
   - User is automatically logged in
   - Redirected to `/dashboard`

5. **Can Access System**
   - User can now log in at `/login` with:
     - Email: maria@municipalidad.gob.ar
     - Password: (the password they just set)

### Email Content Example

```
Para: maria@municipalidad.gob.ar
Asunto: Invitación al Sistema de Gestión de Reclamos

Bienvenido al Sistema de Gestión de Reclamos

Hola,

Has sido invitado a unirte al Sistema de Gestión de Reclamos de la municipalidad.

Para configurar tu contraseña y acceder al sistema, haz clic en el siguiente enlace:

[Configurar mi contraseña]

Importante: Este enlace expirará en 24 horas.

Si no solicitaste esta invitación, puedes ignorar este correo.

Saludos,
Sistema de Gestión de Reclamos
```

### Security Features

1. **No Password Transmission**
   - Admin never sees or handles user passwords
   - Users set their own secure passwords

2. **Token-Based Invitation**
   - One-time use magic link
   - Expires in 24 hours
   - Cannot be reused

3. **Email Verification**
   - Email confirmed through invitation process
   - No separate verification step needed

4. **Role-Based Access**
   - Admin sets role during creation
   - Role determines access permissions
   - Cannot be changed by user

### Common Scenarios

#### New Administrative User
- **Role**: Administrative
- **Access**: Can view/create complaints, view services
- **Cannot**: Access admin panel, create users, configure services

#### New Admin User
- **Role**: Admin
- **Access**: Full system access including user management
- **Can**: Everything Administrative users can + admin features

#### Invitation Expired
- If user doesn't set password within 24 hours:
  - Link expires
  - Admin must create invitation again
  - Original invitation email becomes invalid

#### User Lost Invitation Email
- User can use "¿Olvidaste tu contraseña?" on login page
- Will receive password reset email
- Can set password through reset flow

## Troubleshooting

### Emails not arriving

1. Check Supabase email provider settings
2. Verify sender email is configured
3. Check spam folder
4. Review Supabase logs in **Authentication** → **Logs**

### Wrong language in emails

1. Confirm template was saved correctly
2. Clear browser cache
3. Create a new test user
4. Check Supabase template preview

### Redirect URL incorrect

1. Verify `NEXT_PUBLIC_SITE_URL` environment variable
2. Rebuild and redeploy application
3. Check Vercel environment variables match

## Additional Customization

### Styling

You can add inline CSS to the HTML template for better styling:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0E3F75;">Bienvenido al Sistema de Gestión de Reclamos</h2>
  <!-- rest of template -->
</div>
```

### Custom Logo

Add your municipality logo to the template:

```html
<div style="text-align: center; margin-bottom: 20px;">
  <img src="https://your-domain.com/logo.png" alt="Logo" style="max-width: 200px;" />
</div>
```

## Security Considerations

- Invitation links expire after 24 hours
- Links can only be used once
- Users must set a strong password (minimum 6 characters)
- Email addresses cannot be changed after account creation
- Admin privileges required to invite users

## Related Documentation

- [Authentication Guide](./authentication.md) - User authentication flows
- [UI Specifications](./ui_specifications.md) - User management interface
- [Supabase Docs: Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
