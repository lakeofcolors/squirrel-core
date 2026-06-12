use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rand::{thread_rng, Rng};

pub fn encrypt_message(message: &str, secret: &str) -> String {
    // Generate exactly 32 bytes key from the secret (e.g. by hashing or padding)
    let key_bytes = crate::utils::crypto::derive_key(secret);
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    // Generate 12 bytes nonce
    let mut nonce_bytes = [0u8; 12];
    thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes); // 96-bits; unique per message

    let ciphertext = cipher
        .encrypt(nonce, message.as_bytes())
        .expect("encryption failure");

    // Combine nonce and ciphertext: [nonce (12 bytes) | ciphertext]
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    STANDARD.encode(&combined)
}

pub fn decrypt_message(encoded: &str, secret: &str) -> Result<String, String> {
    let combined = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Base64 error: {}", e))?;
    if combined.len() < 12 {
        return Err("Ciphertext too short".into());
    }

    let key_bytes = crate::utils::crypto::derive_key(secret);
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption error: {:?}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF8 error: {}", e))
}

fn derive_key(secret: &str) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}
