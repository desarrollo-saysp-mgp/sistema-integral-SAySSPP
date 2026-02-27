# Guía de Configuración de Cloudflare

Esta guía explica cómo configurar Cloudflare (plan gratuito) para proteger el Sistema de Gestión de Reclamos (SGR) con bloqueo geográfico, protección WAF y otras medidas de seguridad.

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Requisitos Previos](#requisitos-previos)
3. [Paso 1: Crear Cuenta y Agregar Sitio](#paso-1-crear-cuenta-y-agregar-sitio)
4. [Paso 2: Configurar SSL/TLS](#paso-2-configurar-ssltls)
5. [Paso 3: Bloqueo Geográfico (Solo Argentina)](#paso-3-bloqueo-geográfico-solo-argentina)
6. [Paso 4: Protección WAF](#paso-4-protección-waf)
7. [Paso 5: Bot Fight Mode](#paso-5-bot-fight-mode)
8. [Paso 6: Reglas de Seguridad Adicionales](#paso-6-reglas-de-seguridad-adicionales)
9. [Paso 7: Configuraciones de Seguridad Adicionales](#paso-7-configuraciones-de-seguridad-adicionales)
10. [Paso 8: Verificación y Monitoreo](#paso-8-verificación-y-monitoreo)
11. [Solución de Problemas](#solución-de-problemas)
12. [Mantenimiento](#mantenimiento)

---

## Introducción

### ¿Qué es Cloudflare?

Cloudflare es un servicio de seguridad y rendimiento web que actúa como intermediario entre los visitantes y tu servidor. Proporciona:

- **Protección DDoS**: Mitiga ataques de denegación de servicio
- **WAF (Web Application Firewall)**: Protege contra vulnerabilidades conocidas
- **CDN**: Acelera la carga de tu sitio
- **SSL/TLS gratuito**: Certificados HTTPS automáticos
- **Firewall**: Reglas personalizadas para bloquear tráfico malicioso

### Beneficios del Plan Gratuito

El plan gratuito de Cloudflare incluye:

- ✅ Protección DDoS ilimitada
- ✅ SSL/TLS gratuito
- ✅ 5 reglas de firewall personalizadas
- ✅ WAF con Cloudflare Free Managed Ruleset
- ✅ Bot Fight Mode
- ✅ Bloqueo por país
- ✅ Security Events (logs de seguridad)

### Limitaciones del Plan Gratuito

- ❌ No permite bloqueo a nivel de ciudad (solo país)
- ❌ No incluye Rate Limiting avanzado
- ❌ WAF limitado (solo reglas básicas)

---

## Requisitos Previos

Antes de comenzar, asegúrese de tener:

- [ ] Un **dominio propio** (ej: `mi-sgr.com.ar`)
- [ ] Acceso al **panel de control del registrador** de su dominio (para cambiar nameservers)
- [ ] La **URL de Vercel** donde está desplegado el SGR

---

## Paso 1: Crear Cuenta y Agregar Sitio

### 1.1 Crear Cuenta en Cloudflare

1. Vaya a [cloudflare.com](https://cloudflare.com)
2. Haga clic en **Sign Up**
3. Ingrese su email y una contraseña segura
4. Verifique su email

### 1.2 Agregar su Dominio

1. En el dashboard, haga clic en **Add a Site**
2. Ingrese su dominio (ej: `mi-sgr.com.ar`)
3. Haga clic en **Add site**
4. Seleccione el plan **Free** y haga clic en **Continue**

### 1.3 Revisar Registros DNS

Cloudflare escaneará sus registros DNS actuales:

1. Revise que todos los registros estén correctos
2. Asegúrese de que el registro principal (A o CNAME) apunte a Vercel
3. Haga clic en **Continue**

**Ejemplo de configuración para Vercel:**

| Tipo | Nombre | Contenido | Proxy |
|------|--------|-----------|-------|
| CNAME | @ | cname.vercel-dns.com | ☁️ Proxied |
| CNAME | www | cname.vercel-dns.com | ☁️ Proxied |

### 1.4 Cambiar Nameservers

Cloudflare le proporcionará dos nameservers, por ejemplo:
- `aria.ns.cloudflare.com`
- `bob.ns.cloudflare.com`

**Para cambiarlos:**

1. Vaya al panel de control de su registrador de dominio (NIC Argentina, GoDaddy, etc.)
2. Busque la opción **Nameservers** o **DNS**
3. Reemplace los nameservers actuales por los de Cloudflare
4. Guarde los cambios

**Nota:** La propagación puede tardar hasta 24-48 horas.

### 1.5 Verificar Activación

1. Regrese al dashboard de Cloudflare
2. Haga clic en **Check nameservers**
3. Cuando esté activo, verá un mensaje de confirmación

---

## Paso 2: Configurar SSL/TLS

### 2.1 Modo de Encriptación

1. Vaya a **SSL/TLS** → **Overview**
2. Seleccione **Full (strict)**

| Modo | Descripción |
|------|-------------|
| Off | Sin HTTPS (no recomendado) |
| Flexible | HTTPS solo entre visitante y Cloudflare |
| Full | HTTPS completo, pero acepta certificados no válidos |
| **Full (strict)** | HTTPS completo con certificados válidos (recomendado) |

### 2.2 Habilitar "Always Use HTTPS"

1. Vaya a **SSL/TLS** → **Edge Certificates**
2. Active **Always Use HTTPS**

Esto redirige automáticamente todo el tráfico HTTP a HTTPS.

### 2.3 Configurar HSTS (Opcional pero Recomendado)

1. En **SSL/TLS** → **Edge Certificates**
2. Busque **HTTP Strict Transport Security (HSTS)**
3. Haga clic en **Enable HSTS**
4. Configure:
   - **Max Age**: 6 meses (15768000 segundos)
   - **Include subdomains**: Sí
   - **Preload**: Sí (opcional)
5. Marque la casilla de confirmación y guarde

**Advertencia:** Una vez habilitado HSTS, su sitio SOLO funcionará con HTTPS. Asegúrese de que SSL funciona correctamente antes de habilitarlo.

---

## Paso 3: Bloqueo Geográfico (Solo Argentina)

Esta es la regla más importante para restringir el acceso solo a usuarios de Argentina.

### 3.1 Crear la Regla

1. Vaya a **Security** → **WAF** → **Custom rules**
2. Haga clic en **Create rule**
3. Configure:

**Nombre de la regla:** `Bloquear tráfico fuera de Argentina`

**Expresión (Expression):**
```
(ip.geoip.country ne "AR")
```

**Acción:** `Block`

4. Haga clic en **Deploy**

### 3.2 Explicación de la Regla

| Componente | Significado |
|------------|-------------|
| `ip.geoip.country` | País de origen de la IP del visitante |
| `ne` | "not equal" (no es igual a) |
| `"AR"` | Código ISO de Argentina |

Esta regla bloquea TODO el tráfico que NO proviene de Argentina.

### 3.3 Qué Verá un Usuario Bloqueado

Los usuarios bloqueados verán una página de error de Cloudflare indicando que el acceso está denegado.

---

## Paso 4: Protección WAF

El WAF (Web Application Firewall) protege contra vulnerabilidades conocidas.

### 4.1 Verificar el Managed Ruleset

1. Vaya a **Security** → **WAF** → **Managed rules**
2. Verifique que **Cloudflare Free Managed Ruleset** esté activo (viene activado por defecto)

### 4.2 Qué Protege el Free Managed Ruleset

- **Log4Shell (Log4J)**: Vulnerabilidad crítica en Java
- **Shellshock**: Vulnerabilidad en Bash
- **SQL Injection básico**: Intentos de inyección SQL
- **XSS básico**: Ataques de Cross-Site Scripting
- Otras vulnerabilidades de alto perfil

### 4.3 Revisar Eventos

1. Vaya a **Security** → **Events**
2. Aquí verá todos los intentos bloqueados por el WAF

---

## Paso 5: Bot Fight Mode

Bot Fight Mode bloquea bots maliciosos automáticamente.

### 5.1 Habilitar Bot Fight Mode

1. Vaya a **Security** → **Bots**
2. Active **Bot Fight Mode**

### 5.2 Qué Hace Bot Fight Mode

- Detecta y bloquea bots automatizados
- Usa JavaScript challenges para verificar navegadores reales
- No afecta a bots legítimos (Googlebot, etc.)

**Nota:** Si su aplicación tiene APIs que necesitan ser accedidas por sistemas automatizados (además del Google Sheets backup), puede que necesite ajustar esta configuración.

---

## Paso 6: Reglas de Seguridad Adicionales

Con 5 reglas gratuitas disponibles, aquí hay recomendaciones para usar las restantes:

### Regla 2: Bloquear User-Agents Maliciosos

Esta regla bloquea herramientas comunes usadas por atacantes.

1. Vaya a **Security** → **WAF** → **Custom rules**
2. Haga clic en **Create rule**
3. Configure:

**Nombre:** `Bloquear User-Agents Maliciosos`

**Expresión:**
```
(http.user_agent contains "curl") or
(http.user_agent contains "wget") or
(http.user_agent contains "python-requests") or
(http.user_agent contains "scanner") or
(http.user_agent contains "nikto") or
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nmap") or
(http.user_agent eq "")
```

**Acción:** `Block`

### Regla 3: Permitir Bots Verificados (IMPORTANTE)

Esta regla debe ir ANTES de las reglas de bloqueo para permitir bots legítimos como Googlebot.

1. Cree una nueva regla
2. Configure:

**Nombre:** `Permitir Bots Verificados`

**Expresión:**
```
(cf.client.bot)
```

**Acción:** `Skip` → Seleccione "All remaining custom rules"

3. **Importante:** Reordene esta regla para que sea la PRIMERA en la lista

### Regla 4: Proteger Rutas Sensibles (Opcional)

Protege el panel de administración con un challenge adicional.

**Nombre:** `Proteger Admin`

**Expresión:**
```
(starts_with(http.request.uri.path, "/admin"))
```

**Acción:** `Managed Challenge`

### Regla 5: Bloquear Métodos HTTP No Usados (Opcional)

Si su aplicación solo usa GET y POST, bloquee otros métodos.

**Nombre:** `Bloquear Métodos HTTP Innecesarios`

**Expresión:**
```
(http.request.method ne "GET") and
(http.request.method ne "POST") and
(http.request.method ne "HEAD") and
(http.request.method ne "OPTIONS")
```

**Acción:** `Block`

### Orden Recomendado de Reglas

1. **Permitir Bots Verificados** (Skip)
2. **Bloquear tráfico fuera de Argentina** (Block)
3. **Bloquear User-Agents Maliciosos** (Block)
4. **Proteger Admin** (Managed Challenge)
5. **Bloquear Métodos HTTP Innecesarios** (Block)

---

## Paso 7: Configuraciones de Seguridad Adicionales

### 7.1 Security Level

1. Vaya a **Security** → **Settings**
2. Configure **Security Level** en **Medium** o **High**

| Nivel | Descripción |
|-------|-------------|
| Essentially Off | Sin protección |
| Low | Solo IPs muy sospechosas |
| **Medium** | Balance entre seguridad y usabilidad (recomendado) |
| High | Más challenges, puede afectar usuarios legítimos |
| I'm Under Attack! | Solo para ataques activos |

### 7.2 Challenge Passage

1. En **Security** → **Settings**
2. Configure **Challenge Passage** en **30 minutes**

Esto determina cuánto tiempo un usuario permanece verificado después de pasar un challenge.

### 7.3 Browser Integrity Check

1. En **Security** → **Settings**
2. Active **Browser Integrity Check**

Verifica que las solicitudes vengan de navegadores reales, no de bots.

### 7.4 Hotlink Protection (Opcional)

1. Vaya a **Scrape Shield** → **Hotlink Protection**
2. Active si desea prevenir que otros sitios enlacen directamente a sus recursos

---

## Paso 8: Verificación y Monitoreo

### 8.1 Verificar que las Reglas Funcionan

**Desde Argentina:**
1. Acceda a su sitio normalmente
2. Debería cargar sin problemas

**Desde otro país (usando VPN):**
1. Use una VPN conectada a otro país (ej: Estados Unidos)
2. Intente acceder a su sitio
3. Debería ver una página de bloqueo de Cloudflare

### 8.2 Monitorear Security Events

1. Vaya a **Security** → **Events**
2. Aquí verá:
   - Solicitudes bloqueadas
   - Challenges presentados
   - País de origen de los ataques
   - Qué reglas se activaron

### 8.3 Revisar Analytics

1. Vaya a **Analytics & Logs** → **Security**
2. Revise:
   - Tráfico bloqueado vs permitido
   - Países de origen
   - Tipos de amenazas detectadas

---

## Solución de Problemas

### "Mi sitio no carga"

1. **Verificar DNS:**
   - Vaya a **DNS** → **Records**
   - Asegúrese de que los registros apuntan correctamente a Vercel

2. **Verificar SSL:**
   - Vaya a **SSL/TLS** → **Overview**
   - Asegúrese de que esté en **Full (strict)**
   - Si hay errores, pruebe temporalmente con **Full**

3. **Verificar propagación:**
   - Use [dnschecker.org](https://dnschecker.org) para verificar que los DNS se propagaron
   - Puede tardar hasta 48 horas

### "Usuarios legítimos de Argentina están siendo bloqueados"

1. **Revisar Security Events:**
   - Vaya a **Security** → **Events**
   - Busque la IP del usuario afectado
   - Verifique qué regla lo bloqueó

2. **Verificar IP del usuario:**
   - Pida al usuario que visite [whatismyip.com](https://whatismyip.com)
   - Verifique que la IP se detecta como Argentina

3. **VPN del usuario:**
   - Si el usuario usa VPN, puede aparecer como de otro país
   - Pida que desactive la VPN

4. **Agregar excepción:**
   - Si es una IP legítima de Argentina mal categorizada:
   - Vaya a **Security** → **WAF** → **Tools** → **IP Access Rules**
   - Agregue la IP con acción **Allow**

### "El bloqueo geográfico no funciona"

1. **Verificar que la regla está activa:**
   - Vaya a **Security** → **WAF** → **Custom rules**
   - Verifique que la regla de bloqueo esté habilitada

2. **Verificar el proxy:**
   - En **DNS** → **Records**
   - Asegúrese de que el ícono de nube esté naranja (Proxied)
   - Si está gris (DNS only), el tráfico no pasa por Cloudflare

3. **Verificar orden de reglas:**
   - La regla de "Permitir Bots Verificados" debe estar ANTES del bloqueo geográfico

### "La API de Google Sheets no puede conectarse"

El script de Google Apps accede directamente a Supabase, no a través de su dominio. Por lo tanto, no debería verse afectado por Cloudflare.

Si tiene problemas:
1. Verifique que las credenciales de Supabase en el script son correctas
2. Supabase no está protegido por Cloudflare (tiene su propia seguridad)

---

## Mantenimiento

### Revisión Semanal

1. **Revisar Security Events:**
   - Vaya a **Security** → **Events**
   - Busque patrones de ataques
   - Identifique IPs que deban ser bloqueadas permanentemente

2. **Revisar Analytics:**
   - Vaya a **Analytics & Logs** → **Security**
   - Verifique el porcentaje de tráfico bloqueado

### Revisión Mensual

1. **Actualizar reglas:**
   - Revise si hay nuevos patrones de ataque
   - Ajuste las reglas según necesidad

2. **Revisar IPs bloqueadas:**
   - Vaya a **Security** → **WAF** → **Tools** → **IP Access Rules**
   - Elimine bloqueos temporales que ya no sean necesarios

### En Caso de Ataque Activo

1. **Activar "I'm Under Attack!" mode:**
   - Vaya a **Security** → **Settings**
   - Active **I'm Under Attack!**
   - Esto presenta un challenge de 5 segundos a TODOS los visitantes

2. **Monitorear:**
   - Revise **Security** → **Events** para identificar el origen del ataque

3. **Desactivar después del ataque:**
   - Una vez que el ataque cese, regrese a **Medium** security level

---

## Resumen de Configuración

| Configuración | Valor Recomendado |
|---------------|-------------------|
| SSL/TLS Mode | Full (strict) |
| Always Use HTTPS | Activo |
| Security Level | Medium |
| Bot Fight Mode | Activo |
| Browser Integrity Check | Activo |
| Challenge Passage | 30 minutos |

### Reglas de Firewall Configuradas

| # | Nombre | Expresión | Acción |
|---|--------|-----------|--------|
| 1 | Permitir Bots Verificados | `(cf.client.bot)` | Skip |
| 2 | Bloquear fuera de Argentina | `(ip.geoip.country ne "AR")` | Block |
| 3 | Bloquear User-Agents Maliciosos | Ver expresión arriba | Block |
| 4 | Proteger Admin | `(starts_with(http.request.uri.path, "/admin"))` | Challenge |
| 5 | Disponible para otra regla | - | - |

---

## Recursos Adicionales

- [Documentación oficial de Cloudflare](https://developers.cloudflare.com/)
- [Cloudflare WAF docs](https://developers.cloudflare.com/waf/)
- [Expresiones de firewall](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/)
