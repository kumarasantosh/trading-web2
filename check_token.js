const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/GROWW_API_KEY="?([^"\n]+)"?/);
const jwt = match ? match[1] : '';

if (!jwt || !jwt.startsWith('eyJ')) {
    console.log('Not a JWT token or not found');
    process.exit(0);
}

try {
    const parts = jwt.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('Token Payload:', JSON.stringify(payload, null, 2));

    if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        console.log('Expiry Date:', expDate.toString());
        console.log('Current Date:', new Date().toString());
        console.log('Is Expired:', new Date() > expDate);
    }
} catch (e) {
    console.error('Error decoding token:', e.message);
}
