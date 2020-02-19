// Apple SignIn Auth
// https://developer.apple.com/documentation/signinwithapplerestapi

const Parse = require('parse/node').Parse;
const httpsRequest = require('./httpsRequest');
const NodeRSA = require('node-rsa');
const jwt = require('jsonwebtoken');

const TOKEN_ISSUER = 'https://appleid.apple.com';

let currentKey;

const getApplePublicKey = async keyID => {
  let data;
  try {
    data = await httpsRequest.get('https://appleid.apple.com/auth/keys');
  } catch (e) {
    if (currentKey) {
      return currentKey;
    }
    throw e;
  }

  const key = data.keys.find(key => key.kid === keyID);

  if (!key) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `Public key with matching key ID to token not found`
    );
  }

  const pubKey = new NodeRSA();  
  pubKey.importKey(
    { n: Buffer.from(key.n, 'base64'), e: Buffer.from(key.e, 'base64') },
    'components-public'
  );
  
  currentKey = pubKey.exportKey(['public']);
  return currentKey;
};

const getKeyAndAlgoFromToken = token => {
  const decodedToken = jwt.decode(token,
    {
      complete: true
    }
  );
  if (!decodedToken) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `provided token does not decode as JWT`
    );
  }

  const keyID = decodedToken.header.kid;
  const algo = decodedToken.header.alg;

  return { keyID, algo };
}

const verifyIdToken = async ({ token, id }, clientID) => {
  if (!token) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      'id token is invalid for this user.'
    );
  }

  const decodedToken = getKeyAndAlgoFromToken(token);
  const applePublicKey = await getApplePublicKey(decodedToken.keyID);
  let jwtClaims;
  
  try {
    jwtClaims = jwt.verify(token, applePublicKey, {
      algorithms: decodedToken.algo,
    });
  } catch (exception) {
    const message = exception.message;
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, `${message}`);
  }

  if (jwtClaims.iss !== TOKEN_ISSUER) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `id token not issued by correct OpenID provider - expected: ${TOKEN_ISSUER} | from: ${jwtClaims.iss}`
    );
  }

  if (jwtClaims.sub !== id) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `auth data is invalid for this user.`
    );
  }

  if (!clientID) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `client ids do not exist`
    );
  }

  if (typeof clientID === "string")
    clientID = [clientID];

  if (!Array.isArray(clientID)) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `invalid client id type provided, either string or array`
    );
  }

  if (clientID.length === 0) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `need at least one client id, empty array provided`
    );
  }

  if (!clientID.includes(jwtClaims.aud)) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `jwt aud parameter does not include this client - is: ${jwtClaims.aud} | expected: ${clientID}`
    );
  }
  return jwtClaims;
};

// Returns a promise that fulfills if this id token is valid
function validateAuthData(authData, options = {}) {
  return verifyIdToken(authData, options.client_id);
}

// Returns a promise that fulfills if this app id is valid.
function validateAppId() {
  return Promise.resolve();
}

module.exports = {
  validateAppId,
  validateAuthData,
};
