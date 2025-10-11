// Simple encryption/decryption for storing credentials locally
// NOT FOR PRODUCTION - Use proper encryption in production!

const SECRET_KEY = 'zenshin_secure_key_2024'; // Change this in production

// Simple XOR encryption
export const encryptPassword = (password) => {
  try {
    let encrypted = '';
    for (let i = 0; i < password.length; i++) {
      const charCode = password.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      encrypted += String.fromCharCode(charCode);
    }
    return btoa(encrypted); // Base64 encode
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

export const decryptPassword = (encryptedPassword) => {
  try {
    const decoded = atob(encryptedPassword); // Base64 decode
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Save credentials (only if "Remember Me" is checked)
export const saveCredentials = (username, password) => {
  try {
    const encryptedPassword = encryptPassword(password);
    const credentials = {
      username,
      encryptedPassword,
      timestamp: Date.now()
    };
    localStorage.setItem('zenshin_remembered_user', JSON.stringify(credentials));
    console.log('✓ Credentials saved securely');
  } catch (error) {
    console.error('Error saving credentials:', error);
  }
};

// Get saved credentials
export const getSavedCredentials = () => {
  try {
    const saved = localStorage.getItem('zenshin_remembered_user');
    if (!saved) return null;

    const credentials = JSON.parse(saved);
    
    // Check if credentials are older than 30 days
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - credentials.timestamp > thirtyDays) {
      clearSavedCredentials();
      return null;
    }

    return {
      username: credentials.username,
      password: decryptPassword(credentials.encryptedPassword)
    };
  } catch (error) {
    console.error('Error getting saved credentials:', error);
    return null;
  }
};

// Clear saved credentials
export const clearSavedCredentials = () => {
  try {
    localStorage.removeItem('zenshin_remembered_user');
    console.log('✓ Credentials cleared');
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
};

// Check if user is remembered
export const hasRememberedUser = () => {
  return !!localStorage.getItem('zenshin_remembered_user');
};
