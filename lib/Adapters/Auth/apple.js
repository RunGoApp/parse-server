'use strict';

const Parse = require('parse/node').Parse;

const httpsRequest = require('./httpsRequest');

const NodeRSA = require('node-rsa');

const jwt = require('jsonwebtoken');

const TOKEN_ISSUER = 'https://appleid.apple.com';

const getApplePublicKey = async () => {
  const data = await httpsRequest.get('https://appleid.apple.com/auth/keys');
  const key = data.keys[0];
  const pubKey = new NodeRSA();
  pubKey.importKey({
    n: Buffer.from(key.n, 'base64'),
    e: Buffer.from(key.e, 'base64')
  }, 'components-public');
  return pubKey.exportKey(['public']);
}; // swap id & token


const verifyIdToken = async (token, clientIDs) => {
  if (!token) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'id token is invalid for this user.');
  }

  const applePublicKey = await getApplePublicKey();

  try {
    const jwtClaims = jwt.verify(token, applePublicKey, {
      algorithms: 'RS256'
    });

    if (jwtClaims.iss !== TOKEN_ISSUER) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, `id token not issued by correct OpenID provider - expected: ${TOKEN_ISSUER} | from: ${jwtClaims.iss}`);
    }

    if (typeof clientIDs !== "undefined" && clientIDs && clientIDs.includes(jwtClaims.aud)) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, `jwt aud parameter does not include this client - is: ${jwtClaims.aud} | expected: ${clientIDs}`);
    }

    return jwtClaims;
  } catch (err) {
    // If needed to check what type of error there is, use this:
    // err instanceof jwt.TokenExpiredError
    // err instanceof jwt.JsonWebTokenError
    // err instanceof jwt.NotBeforeError
    // error codes found here in readme: https://github.com/auth0/node-jsonwebtoken#token-expiration-exp-claim under Errors & Codes section
    return Promise.reject(err);
  }
}; // Returns a promise that fulfills if this id token is valid


function validateAuthData(authData, options = {}) {
  return verifyIdToken(authData.id, options.client_ids);
} // Returns a promise that fulfills if this app id is valid.


function validateAppId() {
  return Promise.resolve();
}

module.exports = {
  validateAppId,
  validateAuthData
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9BZGFwdGVycy9BdXRoL2FwcGxlLmpzIl0sIm5hbWVzIjpbIlBhcnNlIiwicmVxdWlyZSIsImh0dHBzUmVxdWVzdCIsIk5vZGVSU0EiLCJqd3QiLCJUT0tFTl9JU1NVRVIiLCJnZXRBcHBsZVB1YmxpY0tleSIsImRhdGEiLCJrZXkiLCJwdWJLZXkiLCJCdWZmZXIiLCJmcm9tIiwidmVyaWZ5SWRUb2tlbiIsImp3dENsYWltcyIsImFsZ29yaXRobXMiLCJjbGllbnRJRCIsInVuZGVmaW5lZCIsInZhbGlkYXRlQXBwSWQiLCJtb2R1bGUiLCJ2YWxpZGF0ZUF1dGhEYXRhIl0sIm1hcHBpbmdzIjoiOztBQUFBLE1BQU1BLEtBQUssR0FBR0MsT0FBTyxDQUFQQSxZQUFPLENBQVBBLENBQWQsS0FBQTs7QUFDQSxNQUFNQyxZQUFZLEdBQUdELE9BQU8sQ0FBNUIsZ0JBQTRCLENBQTVCOztBQUNBLE1BQU1FLE9BQU8sR0FBR0YsT0FBTyxDQUF2QixVQUF1QixDQUF2Qjs7QUFDQSxNQUFNRyxHQUFHLEdBQUdILE9BQU8sQ0FBbkIsY0FBbUIsQ0FBbkI7O0FBRUEsTUFBTUksWUFBWSxHQUFsQiwyQkFBQTs7QUFFQSxNQUFNQyxpQkFBaUIsR0FBRyxZQUFZO0FBQ3BDLFFBQU1DLElBQUksR0FBRyxNQUFNTCxZQUFZLENBQVpBLEdBQUFBLENBQW5CLHFDQUFtQkEsQ0FBbkI7QUFDQSxRQUFNTSxHQUFHLEdBQUdELElBQUksQ0FBSkEsSUFBQUEsQ0FBWixDQUFZQSxDQUFaO0FBRUEsUUFBTUUsTUFBTSxHQUFHLElBQWYsT0FBZSxFQUFmO0FBQ0FBLEVBQUFBLE1BQU0sQ0FBTkEsU0FBQUEsQ0FDRTtBQUFvQyxJQUFBLENBQUVDLEVBQUFBLE1BQU9DLENBQVBELElBQUFBLENBQVlGLEdBQVpFLENBQUFBLENBQUFBLEVBQUFBLFFBQUFBLENBQXRDO0FBQ0EsSUFBQSxDQUFBLEVBQUEsTUFBQSxDQUFBLElBQUEsQ0FBQSxHQUZGRCxDQUFBQSxDQUVFLEVBRkZBLFFBRUU7QUFEQSxHQURGQSxFQUxGLG1CQUtFQTtBQU9GLFNBQU1HLE1BQUFBLENBQUFBLFNBQUFBLENBQWdCLENBQUEsUUFBQSxDQUFoQkEsQ0FBTjtBQUNFLENBYkYsQyxDQWtCRzs7OztBQUNELE1BQUEsQ0FBQSxLQUFBLEVBQUE7QUFDQSxVQUFNQyxJQUFBQSxLQUFTLENBQUcsS0FBWkEsQ0FBZ0RDLEtBQUFBLENBQUFBLEtBQUFBLENBQVksZ0JBQTVERCxFQUFOLG9DQUFNQSxDQUFOO0FBRUE7O0FBS0MsUUFBQSxjQUFBLEdBQUEsTUFBQSxpQkFBQSxFQUFBOzs7QUFDRCxVQUFJRSxTQUFhQyxHQUFBQSxHQUFBQSxDQUFiRCxNQUFhQyxDQUFhSCxLQUFiRyxFQUFhSCxjQUFiRyxFQUFqQjtBQUNFLE1BQUEsVUFBVWhCLEVBQVY7QUFERixLQUFpQmdCLENBQWpCOztBQU1BLFFBQUEsU0FBT0gsQ0FBUCxHQUFBLEtBQUEsWUFBQSxFQUFBO0FBR0YsWUFBQSxJQUFBLEtBQUEsQ0FBQSxLQUFBLEMsNEJBQUEsRSxxR0FBQSxDQUFBO0FBRUU7Ozs0QkFJRixLQUFTSSxDQUFBQSxLQUFULENBQUEsZ0IsRUFDRSx3REFBQSxTQUFBLENBQUEsR0FBQSxnQkFBQSxTQUFBLEU7OztBQUlBQSxXQURlLFNBQ2ZBO0FBQ0FFLEcsQ0FBQUEsT0FBQUEsR0FBQUEsRUFBQUE7QUFGRkQiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBQYXJzZSA9IHJlcXVpcmUoJ3BhcnNlL25vZGUnKS5QYXJzZTtcbmNvbnN0IGh0dHBzUmVxdWVzdCA9IHJlcXVpcmUoJy4vaHR0cHNSZXF1ZXN0Jyk7XG5jb25zdCBOb2RlUlNBID0gcmVxdWlyZSgnbm9kZS1yc2EnKTtcbmNvbnN0IGp3dCA9IHJlcXVpcmUoJ2pzb253ZWJ0b2tlbicpO1xuXG5jb25zdCBUT0tFTl9JU1NVRVIgPSAnaHR0cHM6Ly9hcHBsZWlkLmFwcGxlLmNvbSc7XG5cbmNvbnN0IGdldEFwcGxlUHVibGljS2V5ID0gYXN5bmMgKCkgPT4ge1xuICBjb25zdCBkYXRhID0gYXdhaXQgaHR0cHNSZXF1ZXN0LmdldCgnaHR0cHM6Ly9hcHBsZWlkLmFwcGxlLmNvbS9hdXRoL2tleXMnKTtcbiAgY29uc3Qga2V5ID0gZGF0YS5rZXlzWzBdO1xuXG4gIGNvbnN0IHB1YktleSA9IG5ldyBOb2RlUlNBKCk7XG4gIHB1YktleS5pbXBvcnRLZXkoXG4gICAgeyBuOiBCdWZmZXIuZnJvbShrZXkubiwgJ2Jhc2U2NCcpLCBlOiBCdWZmZXIuZnJvbShrZXkuZSwgJ2Jhc2U2NCcpIH0sXG4gICAgJ2NvbXBvbmVudHMtcHVibGljJ1xuICApO1xuICByZXR1cm4gcHViS2V5LmV4cG9ydEtleShbJ3B1YmxpYyddKTtcbn07XG5cbmNvbnN0IHZlcmlmeUlkVG9rZW4gPSBhc3luYyAodG9rZW4sIGNsaWVudElEKSA9PiB7XG4gIGlmICghdG9rZW4pIHtcbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELFxuICAgICAgJ2lkIHRva2VuIGlzIGludmFsaWQgZm9yIHRoaXMgdXNlci4nXG4gICAgKTtcbiAgfVxuICBjb25zdCBhcHBsZVB1YmxpY0tleSA9IGF3YWl0IGdldEFwcGxlUHVibGljS2V5KCk7XG4gIGNvbnN0IGp3dENsYWltcyA9IGp3dC52ZXJpZnkodG9rZW4sIGFwcGxlUHVibGljS2V5LCB7IGFsZ29yaXRobXM6ICdSUzI1NicgfSk7XG5cbiAgaWYgKGp3dENsYWltcy5pc3MgIT09IFRPS0VOX0lTU1VFUikge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICBgaWQgdG9rZW4gbm90IGlzc3VlZCBieSBjb3JyZWN0IE9wZW5JRCBwcm92aWRlciAtIGV4cGVjdGVkOiAke1RPS0VOX0lTU1VFUn0gfCBmcm9tOiAke2p3dENsYWltcy5pc3N9YFxuICAgICk7XG4gIH1cbiAgaWYgKGNsaWVudElEICE9PSB1bmRlZmluZWQgJiYgand0Q2xhaW1zLmF1ZCAhPT0gY2xpZW50SUQpIHtcbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELFxuICAgICAgYGp3dCBhdWQgcGFyYW1ldGVyIGRvZXMgbm90IGluY2x1ZGUgdGhpcyBjbGllbnQgLSBpczogJHtqd3RDbGFpbXMuYXVkfSB8IGV4cGVjdGVkOiAke2NsaWVudElEfWBcbiAgICApO1xuICB9XG4gIHJldHVybiBqd3RDbGFpbXM7XG59O1xuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIGlmIHRoaXMgaWQgdG9rZW4gaXMgdmFsaWRcbmZ1bmN0aW9uIHZhbGlkYXRlQXV0aERhdGEoYXV0aERhdGEsIG9wdGlvbnMgPSB7fSkge1xuICByZXR1cm4gdmVyaWZ5SWRUb2tlbihhdXRoRGF0YS5pZCwgb3B0aW9ucy5jbGllbnRfaWQpO1xufVxuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIGlmIHRoaXMgYXBwIGlkIGlzIHZhbGlkLlxuZnVuY3Rpb24gdmFsaWRhdGVBcHBJZCgpIHtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdmFsaWRhdGVBcHBJZCxcbiAgdmFsaWRhdGVBdXRoRGF0YSxcbn07XG4iXX0=