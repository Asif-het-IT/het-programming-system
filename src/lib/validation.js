/**
 * Validation schemas and utilities for enterprise data integrity
 */

export const ValidationSchemas = {
  email: {
    validate: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    message: 'Valid email required'
  },
  password: {
    validate: (pwd) => pwd && pwd.length >= 8,
    message: 'Password must be at least 8 characters'
  },
  passwordStrength: {
    validate: (pwd) => {
      const hasUpper = /[A-Z]/.test(pwd);
      const hasLower = /[a-z]/.test(pwd);
      const hasNumber = /[0-9]/.test(pwd);
      const hasSpecial = /[!@#$%^&*]/.test(pwd);
      return hasUpper && hasLower && hasNumber && hasSpecial;
    },
    message: 'Password must include uppercase, lowercase, number, and special character'
  },
  url: {
    validate: (url) => {
      try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    message: 'Valid HTTPS URL required'
  },
  apiToken: {
    validate: (token) => token && token.length >= 20,
    message: 'API token must be at least 20 characters'
  },
  orderData: {
    validate: (order) => {
      return order.sr && order.brand && order.status;
    },
    message: 'Order must have sr, brand, and status'
  }
};

/**
 * Validate form field with schema
 */
export const validateField = (field, value, schema) => {
  if (!schema) return { valid: true };
  const valid = schema.validate(value);
  return {
    valid,
    error: valid ? null : schema.message
  };
};

/**
 * Sanitize string to prevent XSS
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 1000); // Max length
};

/**
 * Validate URL is safe (prevents SSRF)
 */
export const validateUrl = (url, allowedDomains = []) => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (allowedDomains.length > 0) {
      return allowedDomains.includes(u.hostname);
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Escape CSV special characters to prevent injection
 */
export const escapeCsvField = (field) => {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // Check for formula injection patterns
  if (/^[=+@-]/.test(str)) {
    return "'" + str; // Prefix with apostrophe
  }
  // Escape quotes and wrap if contains comma/newline
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

/**
 * Validate data against schema before insert/update
 */
export const validateDataIntegrity = (data, requiredFields = []) => {
  const errors = [];
  
  requiredFields.forEach(field => {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Check for suspicious data types
  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith('__') || key.startsWith('constructor')) {
      errors.push(`Suspicious field name: ${key}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
