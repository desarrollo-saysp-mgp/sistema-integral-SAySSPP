# Core Functionality

## 1. Authentication System

### Login Page
- Users must authenticate before accessing the system
- Recommended approach: OAuth implementation
- Alternative: Email/password with Supabase Auth

### User Roles
Two distinct roles with different permissions:

#### Admin Role
- Full system access
- User management capabilities
- Can create, read, update, and delete users
- Access to admin panel
- Can load complaints and view complaint table

#### Administrative Role
- Limited access
- Can load new complaints
- Can view complaint table
- Cannot access admin panel
- Cannot manage users

## 2. Complaint Management

### Complaint Creation
Users can create new complaints with the following fields:

**Required Fields:**
- **Complaint Number**: Auto-generated format `SASP-R[padded-id]`
- **Complaint Date**: Defaults to current date (editable)
- **Full Name**: First and last name of the person filing the complaint
- **Address**: Location where service is required
- **Street Number**: House/building number
- **Service**: Selected from predefined services
- **Cause**: Related to the selected service
- **Zone**: Geographic zone
- **Since When**: Date when the issue started
- **Contact Method**: Options: In-person/Phone/Email/WhatsApp
- **Details**: Text area for complaint description
- **Status**: Options: "In Progress" (default), "Resolved", "Unresolved"
- **Referred**: Yes/No
- **Loaded By**: Auto-filled with logged-in user's name

**Optional Fields:**
- **DNI**: National ID number

### Complaint Viewing and Management

#### Complaint Table View
- Display all complaints in a table format
- Only the "Status" field is editable directly in the table
- Users can change status between: In Progress → Resolved/Unresolved
- Clicking on a complaint row opens the detailed view

#### Detailed Complaint View
- Accessed by clicking on a specific complaint in the table
- All complaint fields are editable
- Changes are saved to the database
- Ability to update any field except the complaint number

## 3. Service Management

### Service Configuration Page
Allows administrators to configure services and their associated causes:

**Service Creation:**
- Add new service with a name
- Each service can have multiple causes

**Cause Management:**
- Add multiple causes for each service
- Causes are linked to their parent service
- Used in dropdown when creating complaints

### Service-Cause Relationship
- One service can have many causes
- When creating a complaint, selecting a service filters available causes
- This creates a cascading dropdown effect

## 4. User Management (Admin Only)

### User Registration
Admins can create new users with the following information:
- **Full Name**: First and last name
- **Role**: Admin or Administrative
- **Email**: Used for login and notifications

### User Management Interface
- View list of all users
- Edit user information:
  - Update name
  - Change role
  - Modify email
- Delete users (if required)

## 5. Data Synchronization

### Google Sheets Backup
- Automatic synchronization with Google Sheets
- Serves as backup in case of database issues
- Implemented using Google Apps Script
- Keeps complaint data updated in real-time or on schedule

## 6. General System Behaviors

### Auto-fill Behaviors
- Complaint Date: Auto-fills with current date
- Loaded By: Auto-fills with logged-in user's full name
- Complaint Number: Auto-generated on creation

### Default Values
- Status: "In Progress"
- Referred: "No" (or empty)

### Data Validation
- Required fields must be completed before saving
- Date fields should use date pickers
- Dropdown fields should prevent invalid entries
- Email format validation for user registration
