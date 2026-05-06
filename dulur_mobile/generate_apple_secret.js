const jwt = require('jsonwebtoken');
const fs = require('fs');

// VINSAMLEGAST FYLLTU ÚT ÞESSI 4 ATRIÐI:
const teamId = '63Z3833G4P';                  // Dæmi: "A1B2C3D4E5" (Sést í Apple Developer efst í horninu)
// MIKILVÆGT FYRIR VEF (WEBSITE): Þú MÁTT EKKI nota App ID ('is.dulur.app') hér fyrir vefinn!
// Þú verður að búa til "Services ID" (t.d. "is.dulur.web") í Apple Developer -> Identifiers, 
// tengja það við primary App ID, og setja Return URL. Notaðu síðan Services ID-ið hér.
const clientId = 'is.dulur.web';                // Breyttu þessu í þitt "Services ID" identifier!
const keyId = 'N2ZXKT96XF';                    // Dæmi: "X9Y8Z7K6L5" (Færð thegar the býrð til lykilinn í Apple Developer)

// STUÐNINGUR FYRIR .p8 SKJALIÐ. 
// Settu annaðhvort skráarnafnið hér (T.d. AuthKey_X9Y8Z7K6L5.p8) og vistaðu  
// theað í mobile möppuna, EÐA peistaðu the textanum the beint í staðinn fyrir fs.readFileSync
const privateKeyPath = './AuthKey_N2ZXKT96XF.p8'; 

try {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  // Búa til JWT dulkóðunina sem rennur út eftir 180 daga (Hæsta theleyfilega hjá Apple)
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    issuer: teamId,
    audience: 'https://appleid.apple.com',
    subject: clientId,
    keyid: keyId,
  });

  console.log('\n=======================================');
  console.log('✅ HÉR ER SECRET KEY (JWT) FYRIR SUPABASE:');
  console.log('=======================================\n');
  console.log(token);
  console.log('\n=======================================');
  console.log('Kóperaðu allan textann thehér the að ofan og the peistaðu inn í "Secret Key" the í the Supabase.');

} catch (error) {
  console.error("VILLA: Fannst ekki .p8 the skjalið. Gakktu the úr the skugga um the að The skráin the heiti", privateKeyPath, "og s The s sé The í somu möppu og thettad srcipt.");
}
