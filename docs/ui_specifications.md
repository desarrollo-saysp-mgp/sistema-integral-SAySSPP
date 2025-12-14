# UI Specifications

## Design Principles

- **Clean and Professional**: Minimal, government-appropriate design
- **Responsive**: Works on desktop, tablet, and mobile
- **Accessible**: WCAG 2.1 AA compliance
- **Fast**: Optimized loading and interactions
- **User-Friendly**: Clear navigation and intuitive forms
- **Spanish Language**: All UI text, labels, buttons, messages, and error messages must be in Spanish

## 🎨 Paleta de Colores Institucional

### Colores Principales

- **Azul claro institucional** (Primary)
  - HEX: `#5CADEB`
  - RGB: `92, 173, 235`
  - Uso: Botones primarios, enlaces, encabezados destacados

- **Azul oscuro** (Primary Dark)
  - HEX: `#0E3F75`
  - RGB: `14, 63, 117`
  - Uso: Header, navegación, footer, textos importantes

- **Azul medio / celeste** (Secondary)
  - HEX: `#88C1ED`
  - RGB: `136, 193, 237`
  - Uso: Elementos secundarios, hover states, badges

### Colores de Superficie y Texto

- **Gris muy claro** (Background)
  - HEX: `#F5F6F8`
  - RGB: `245, 246, 248`
  - Uso: Fondo de página, áreas de contenido

- **Gris claro** (Border/Divider)
  - HEX: `#D9DDE3`
  - RGB: `217, 221, 227`
  - Uso: Bordes, divisores, elementos deshabilitados

- **Negro / gris oscuro** (Text)
  - HEX: `#333333`
  - RGB: `51, 51, 51`
  - Uso: Texto principal, contenido

### Variables CSS

```css
:root {
  /* Institutional Colors */
  --primary: #5cadeb; /* Azul claro institucional */
  --primary-dark: #0e3f75; /* Azul oscuro */
  --secondary: #88c1ed; /* Azul medio / celeste */

  /* Neutral Colors */
  --background: #f5f6f8; /* Gris muy claro */
  --surface: #ffffff; /* Blanco para cards */
  --border: #d9dde3; /* Gris claro */
  --text: #333333; /* Negro / gris oscuro */
  --text-muted: #64748b; /* Texto secundario */

  /* Status Colors (complement institutional palette) */
  --success: #10b981; /* Verde para estados exitosos */
  --warning: #f59e0b; /* Naranja para advertencias */
  --danger: #ef4444; /* Rojo para errores */
}
```

### Guía de Uso

**Botones:**

- Primarios: `--primary` (#5CADEB) con hover en `--primary-dark` (#0E3F75)
- Secundarios: `--secondary` (#88C1ED)
- Destructivos: `--danger` (#ef4444)

**Navegación:**

- Header/Sidebar: `--primary-dark` (#0E3F75)
- Elementos activos: `--primary` (#5CADEB)

**Formularios:**

- Campos: Borde `--border` (#D9DDE3)
- Focus: `--primary` (#5CADEB)
- Error: `--danger` (#ef4444)

## Layout Structure

### Main Layout

```
┌────────────────────────────────────────────────────────┐
│ Navbar (Logo | Dashboard | Reclamos | Admin* | User)  │
├────────────────────────────────────────────────────────┤
│                                                        │
│                  Main Content Area                     │
│                                                        │
│                  Page content here                     │
│                                                        │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

\*Admin menu items only visible to Admin role users

### Navbar Specifications

**Layout**: Fixed top navigation bar with horizontal menu items

**Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Dashboard  Reclamos  [Admin Menu]*  [User Dropdown] │
└─────────────────────────────────────────────────────────────┘
```

**Components**:

1. **Logo (Left)**
   - Application logo/icon
   - Clickable, redirects to dashboard (`/dashboard`)
   - Size: ~40px height
   - Color: White or institutional colors

2. **Navigation Menu Items (Center-Left)**

   **For All Authenticated Users:**
   - 🏠 **Dashboard** (`/dashboard`)
     - Icon: Home
     - Label: "Dashboard" or "Inicio"

   - 📋 **Reclamos** (Dropdown)
     - Icon: File/Document
     - Label: "Reclamos"
     - Submenu:
       - "+ Nuevo Reclamo" → `/dashboard/complaints/new`
       - "Ver Todos" → `/dashboard/complaints`

   **For Admin Users Only:**
   - ⚙️ **Administración** (Dropdown)
     - Icon: Settings/Gear
     - Label: "Administración"
     - Submenu:
       - "👥 Usuarios" → `/admin/users`
       - "🏷️ Servicios" → `/admin/services`

3. **User Menu (Right)**
   - Display: User's full name or email
   - Icon: User avatar/icon
   - Dropdown menu:
     - "Mi Perfil" (future feature)
     - "Cerrar Sesión" → Logout

**Styling**:
- Background: `--primary-dark` (#0E3F75)
- Text color: White (#FFFFFF)
- Active item: `--primary` (#5CADEB) background or underline
- Hover: `--secondary` (#88C1ED) background or lighter shade
- Height: 64px
- Shadow: `0 2px 4px rgba(0,0,0,0.1)`
- Font weight: 500 (medium)

**Behavior**:
- Sticky/Fixed position at top
- Dropdowns open on click or hover
- Active route highlighted
- Mobile: Hamburger menu for small screens
- Smooth transitions for hover and active states

### Role-Based Navigation

**Administrative Users Can See:**
```
[Logo] Dashboard | Reclamos ▼ | [User Name ▼]
```

**Admin Users Can See:**
```
[Logo] Dashboard | Reclamos ▼ | Administración ▼ | [User Name ▼]
```

### Mobile Layout (< 768px)

```
┌─────────────────────────────┐
│ [Logo] [☰ Menu] [User Icon]│
├─────────────────────────────┤
│                             │
│    Main Content Area        │
│                             │
└─────────────────────────────┘
```

**Mobile Menu (when hamburger clicked)**:
```
┌─────────────────────────────┐
│ ✕ Cerrar                    │
├─────────────────────────────┤
│ 🏠 Dashboard                │
│ 📋 Reclamos                 │
│   └ + Nuevo Reclamo         │
│   └ Ver Todos               │
│ ⚙️ Administración*          │
│   └ 👥 Usuarios             │
│   └ 🏷️ Servicios            │
│ 👤 [User Name]              │
│   └ Cerrar Sesión           │
└─────────────────────────────┘
```

## Page Specifications

### 1. Login Page (`/login`)

**Layout**: Centered card on full screen with background

**Elements**:

- Application logo/title
- Email input field
- Password input field
- "Show/Hide password" toggle
- "Login" button
- "Forgot password?" link
- Error message display area

**Validation**:

- Email format validation
- Required field indicators
- Clear error messages for invalid credentials

**States**:

- Loading state while authenticating
- Disabled form during submission
- Error state with message

**Example Structure**:

```
┌────────────────────────────┐
│                            │
│  [Logo/Title]              │
│                            │
│  Portal de Reclamos        │
│  Secretaría Municipal      │
│                            │
│  ┌──────────────────────┐  │
│  │ Email               │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │ Password      [👁]  │  │
│  └──────────────────────┘  │
│                            │
│  ¿Olvidó su contraseña?    │
│                            │
│  [    Iniciar Sesión    ]  │
│                            │
└────────────────────────────┘
```

### 2. Dashboard / Home (`/dashboard`)

**Purpose**: Landing page after login with summary statistics

**Elements**:

- Welcome message with user name
- Summary cards:
  - Total complaints
  - In progress
  - Resolved
  - Unresolved
- Recent complaints list (last 5)
- Quick action buttons:
  - "New Complaint"
  - "View All Complaints"

**Layout**:

```
┌────────────────────────────────────────────┐
│ Bienvenido, [User Name]                   │
├────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│ │ 156 │ │  45 │ │  98 │ │  13 │          │
│ │Total│ │Proc.│ │Resol│ │No R.│          │
│ └─────┘ └─────┘ └─────┘ └─────┘          │
│                                            │
│ Reclamos Recientes                         │
│ ┌────────────────────────────────────────┐ │
│ │ SASP-R000123 | En proceso | 16/11/2025│ │
│ │ SASP-R000122 | Resuelto   | 15/11/2025│ │
│ │ SASP-R000121 | En proceso | 15/11/2025│ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [+ Nuevo Reclamo]  [Ver Todos]            │
└────────────────────────────────────────────┘
```

### 3. New Complaint Page (`/dashboard/complaints/new`)

**Layout**: Form with sections

**Form Sections**:

**Section 1: Basic Information**

- Complaint Number (auto-generated, read-only, displayed after save)
- Complaint Date (date picker, default today)

**Section 2: Complainant Information**

- Full Name (text input, required)
- Address (text input, required)
- Street Number (text input, required)
- DNI (text input, optional)
- Contact Method (radio buttons: Presencial/Teléfono/Email/WhatsApp)

**Section 3: Complaint Details**

- Service (dropdown, required)
- Cause (dropdown, filtered by service, required)
- Zone (text input or dropdown, required)
- Since When (date picker, required)
- Details (textarea, required, min 20 characters)

**Section 4: Status**

- Status (radio buttons: En proceso [default], Resuelto, No resuelto)
- Referred (checkbox)

**Section 5: System Information**

- Loaded By (auto-filled, read-only, shows current user)

**Actions**:

- "Save Complaint" button (primary)
- "Cancel" button (secondary)

**Validation**:

- All required fields must be filled
- Dates cannot be in the future
- "Since When" cannot be after "Complaint Date"
- Details must have minimum length

**Example Layout**:

```
┌────────────────────────────────────────────┐
│ Nuevo Reclamo                              │
├────────────────────────────────────────────┤
│                                            │
│ Información Básica                         │
│ ┌──────────────┐                          │
│ │ Fecha │ 16/11/2025                      │
│ └──────────────┘                          │
│                                            │
│ Datos del Reclamante                       │
│ ┌───────────────────────┐                 │
│ │ Nombre y Apellido*   │                 │
│ └───────────────────────┘                 │
│ ┌──────────────┐ ┌────────┐              │
│ │ Dirección*   │ │ Nro.*  │              │
│ └──────────────┘ └────────┘              │
│ ┌──────────────┐                          │
│ │ DNI          │                          │
│ └──────────────┘                          │
│ Medio de Contacto:                        │
│ ○ Presencial  ○ Teléfono                 │
│ ○ Email       ○ WhatsApp                 │
│                                            │
│ Detalles del Reclamo                       │
│ ┌──────────────┐ ┌──────────────┐        │
│ │ Servicio*   ▼│ │ Causa*      ▼│        │
│ └──────────────┘ └──────────────┘        │
│ ┌──────────────┐ ┌──────────────┐        │
│ │ Zona*        │ │ Desde Cuándo*│        │
│ └──────────────┘ └──────────────┘        │
│ ┌────────────────────────────────────┐   │
│ │ Detalle*                           │   │
│ │                                    │   │
│ │                                    │   │
│ └────────────────────────────────────┘   │
│                                            │
│ Estado y Seguimiento                       │
│ ○ En proceso  ○ Resuelto  ○ No resuelto  │
│ ☐ Derivado                                │
│                                            │
│ Responsable: [User Name] (auto)           │
│                                            │
│ [Cancelar]        [Guardar Reclamo]       │
└────────────────────────────────────────────┘
```

### 4. Complaints Table Page (`/dashboard/complaints`)

**Layout**: Table with filters and search

**Header**:

- Page title
- Search bar (search by complaint number, name, address)
- Filter dropdowns:
  - Status filter
  - Service filter
  - Date range filter
- "New Complaint" button

**Table Columns**:

1. Complaint Number (clickable)
2. Date
3. Complainant Name
4. Service
5. Cause
6. Zone
7. Status (inline editable dropdown)
8. Loaded By

**Table Features**:

- Sortable columns
- Pagination (20 items per page)
- Row highlighting on hover
- Click anywhere on row to view details
- Status can be changed inline without opening detail view

**Example Layout**:

```
┌────────────────────────────────────────────────────────────┐
│ Reclamos                    [🔍 Buscar...] [+ Nuevo]       │
├────────────────────────────────────────────────────────────┤
│ Filtros: [Estado▼] [Servicio▼] [Desde: __] [Hasta: __]   │
├────────────────────────────────────────────────────────────┤
│ Nº Reclamo  │Fecha │Nombre   │Servicio│Estado▼ │Cargado  │
├─────────────┼──────┼─────────┼────────┼────────┼─────────┤
│ SASP-R00123 │16/11 │Juan P.  │Alumbr. │[Proc.]▼│Admin    │
│ SASP-R00122 │15/11 │Maria G. │Basura  │[Resuel]│Juana    │
│ SASP-R00121 │15/11 │Pedro L. │Calles  │[Proc.]▼│Admin    │
│ ...                                                         │
├────────────────────────────────────────────────────────────┤
│ Mostrando 1-20 de 156    [<] [1] [2] [3] [4] [>]         │
└────────────────────────────────────────────────────────────┘
```

### 5. Complaint Detail Page (`/dashboard/complaints/[id]`)

**Layout**: Form similar to new complaint, but with all fields editable

**Header**:

- Complaint Number (large, prominent)
- Created date and time
- Last updated date and time
- Back button

**Content**:

- All fields from new complaint form
- All fields are editable (except complaint number and loaded by)
- Same validation rules apply

**Actions**:

- "Save Changes" button
- "Cancel" button
- "Delete" button (only for Admin, with confirmation)

**Additional Features**:

- Change history/audit log (future enhancement)
- Attached documents (future enhancement)

### 6. Services Management Page (`/admin/services`)

**Admin Only**

**Layout**: Two-panel view

**Left Panel: Services List**

- List of all services
- "Add Service" button
- Each service shows:
  - Service name
  - Number of causes
  - Edit/Delete buttons

**Right Panel: Selected Service Details**

- Service name (editable)
- List of causes for this service
- "Add Cause" button
- Each cause shows:
  - Cause name
  - Edit/Delete buttons

**Example Layout**:

```
┌──────────────────┬──────────────────────────┐
│ Servicios        │ Causas: Alumbrado Público│
│ [+ Nuevo]        │ [+ Nueva Causa]          │
├──────────────────┼──────────────────────────┤
│ ▶ Alumbrado (3)  │ • Lámpara fundida  [✏️][🗑]│
│   - Edit/Delete  │ • Poste dañado     [✏️][🗑]│
│                  │ • Falta iluminación[✏️][🗑]│
│   Basura (3)     │                          │
│   - Edit/Delete  │                          │
│                  │                          │
│   Calles (3)     │                          │
│   - Edit/Delete  │                          │
│                  │                          │
│   Espacios (3)   │                          │
│   - Edit/Delete  │                          │
└──────────────────┴──────────────────────────┘
```

### 7. User Management Page (`/admin/users`)

**Admin Only**

**Header**:

- Page title
- Search bar (search by name or email)
- "Add User" button
- Filter by role

**Table Columns**:

1. Full Name
2. Email
3. Role
4. Created Date
5. Actions (Edit/Delete)

**Example Layout**:

```
┌────────────────────────────────────────────────┐
│ Usuarios                [🔍 Buscar] [+ Nuevo]  │
├────────────────────────────────────────────────┤
│ Nombre         │Email          │Rol    │Acción│
├────────────────┼───────────────┼───────┼──────┤
│ Admin Usuario  │admin@mail.com │Admin  │[✏️][🗑]│
│ Juana Martinez │juana@mail.com │Admin. │[✏️][🗑]│
│ Pedro Gomez    │pedro@mail.com │Admin. │[✏️][🗑]│
└────────────────────────────────────────────────┘
```

### 8. New User Page (`/admin/users/new`)

**Admin Only**

**Form Fields**:

- Full Name (required)
- Email (required, validated)
- Role (required, radio buttons: Admin / Administrative)

**Actions**:

- "Create User" button
- "Cancel" button

**Process**:

1. Admin fills form
2. System creates user
3. System sends invitation email
4. Success message displayed
5. Redirect to users list

## Component Library Suggestions

### Recommended UI Framework

- **Shadcn/ui**: Accessible components built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Icons**: Icon library

### Key Components Needed

- Form inputs (text, email, date, textarea)
- Dropdowns/Select boxes
- Radio buttons
- Checkboxes
- Buttons (primary, secondary, danger)
- Data table with sorting and pagination
- Modal dialogs
- Toast notifications
- Loading spinners
- Date picker
- Search/filter bar

## Responsive Breakpoints

```css
/* Mobile: < 640px */
/* Tablet: 640px - 1024px */
/* Desktop: > 1024px */

@media (max-width: 640px) {
  /* Stack form fields vertically */
  /* Hide sidebar, show hamburger menu */
  /* Simplify table to cards */
}

@media (min-width: 641px) and (max-width: 1024px) {
  /* Collapsible sidebar */
  /* Two-column forms */
}
```

## Accessibility Requirements

- All interactive elements keyboard accessible
- Proper ARIA labels
- Focus indicators visible
- Color contrast ratio 4.5:1 minimum
- Form labels properly associated
- Error messages announced to screen readers
- Semantic HTML structure

## Loading States

- Skeleton loaders for tables
- Spinner for form submissions
- Progress indicators for file uploads
- Disabled state for buttons during processing

## Error Handling

- Inline validation errors below fields
- Toast notifications for system errors
- Confirmation dialogs for destructive actions
- Clear error messages in user's language (Spanish)

## Success Feedback

- Toast notifications for successful actions
- Inline success messages
- Visual confirmation (checkmarks, green borders)
- Auto-redirect after successful submission
