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
  pubKey.importKey(
    {
      n: Buffer.from(key.n, 'base64'),
      e: Buffer.from(key.e, 'base64'),
    },
    'components-public'
  );
  return pubKey.exportKey(['public']);
}; // swap id & token

const verifyIdToken = async (token, clientIDs) => {
  if (!token) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      'id token is invalid for this user.'
    );
  }

  const applePublicKey = await getApplePublicKey();

  const jwtClaims = jwt.verify(token, applePublicKey, {
    algorithms: 'RS256',
  });

  console.log('JWT Claims', jwtClaims);
  console.log(typeof jwtClaims);

  if (jwtClaims.iss !== TOKEN_ISSUER) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `id token not issued by correct OpenID provider - expected: ${TOKEN_ISSUER} | from: ${jwtClaims.iss}`
    );
  }

  console.log(clientIDs);
  console.log(clientIDs.includes(jwtClaims.aud));
  if (
    typeof clientIDs !== 'undefined' &&
    clientIDs &&
    !clientIDs.includes(jwtClaims.aud)
  ) {
    throw new Parse.Error(
      Parse.Error.OBJECT_NOT_FOUND,
      `jwt aud parameter does not include this client - is: ${jwtClaims.aud} | expected: ${clientIDs}`
    );
  }

  return jwtClaims;
  // If needed to check what type of error there is, use this:
  // err instanceof jwt.TokenExpiredError
  // err instanceof jwt.JsonWebTokenError
  // err instanceof jwt.NotBeforeError
  // error codes found here in readme: https://github.com/auth0/node-jsonwebtoken#token-expiration-exp-claim under Errors & Codes section
}; // Returns a promise that fulfills if this id token is valid

function validateAuthData(authData, options = {}) {
  return verifyIdToken(authData.id, options.client_ids);
} // Returns a promise that fulfills if this app id is valid.

function validateAppId() {
  return Promise.resolve();
}

module.exports = {
  validateAppId,
  validateAuthData,
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9BZGFwdGVycy9BdXRoL2FwcGxlLmpzIl0sIm5hbWVzIjpbIlBhcnNlIiwicmVxdWlyZSIsImh0dHBzUmVxdWVzdCIsIk5vZGVSU0EiLCJqd3QiLCJUT0tFTl9JU1NVRVIiLCJnZXRBcHBsZVB1YmxpY0tleSIsImRhdGEiLCJrZXkiLCJwdWJLZXkiLCJCdWZmZXIiLCJmcm9tIiwidmVyaWZ5SWRUb2tlbiIsImp3dENsYWltcyIsImFsZ29yaXRobXMiLCJjbGllbnRJRCIsInVuZGVmaW5lZCIsIlByb21pc2UiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOztBQUFBLE1BQU1BLEtBQUssR0FBR0MsT0FBTyxDQUFQQSxZQUFPLENBQVBBLENBQWQsS0FBQTs7QUFDQSxNQUFNQyxZQUFZLEdBQUdELE9BQU8sQ0FBNUIsZ0JBQTRCLENBQTVCOztBQUNBLE1BQU1FLE9BQU8sR0FBR0YsT0FBTyxDQUF2QixVQUF1QixDQUF2Qjs7QUFDQSxNQUFNRyxHQUFHLEdBQUdILE9BQU8sQ0FBbkIsY0FBbUIsQ0FBbkI7O0FBRUEsTUFBTUksWUFBWSxHQUFsQiwyQkFBQTs7QUFFQSxNQUFNQyxpQkFBaUIsR0FBRyxZQUFZO0FBQ3BDLFFBQU1DLElBQUksR0FBRyxNQUFNTCxZQUFZLENBQVpBLEdBQUFBLENBQW5CLHFDQUFtQkEsQ0FBbkI7QUFDQSxRQUFNTSxHQUFHLEdBQUdELElBQUksQ0FBSkEsSUFBQUEsQ0FBWixDQUFZQSxDQUFaO0FBRUEsUUFBTUUsTUFBTSxHQUFHLElBQWYsT0FBZSxFQUFmO0FBQ0FBLEVBQUFBLE1BQU0sQ0FBTkEsU0FBQUEsQ0FDRTtBQUFvQyxJQUFBLENBQUVDLEVBQUFBLE1BQU9DLENBQVBELElBQUFBLENBQVlGLEdBQVpFLENBQUFBLENBQUFBLEVBQUFBLFFBQUFBLENBQXRDO0FBQ0EsSUFBQSxDQUFBLEVBQUEsTUFBQSxDQUFBLElBQUEsQ0FBQSxHQUZGRCxDQUFBQSxDQUVFLEVBRkZBLFFBRUU7QUFEQSxHQURGQSxFQUxGLG1CQUtFQTtBQU9GLFNBQU1HLE1BQUFBLENBQUFBLFNBQUFBLENBQWdCLENBQUEsUUFBQSxDQUFoQkEsQ0FBTjtBQUNFLENBYkYsQyxDQWtCRzs7OztBQUNELE1BQUEsQ0FBQSxLQUFBLEVBQUE7QUFDQSxVQUFNQyxJQUFBQSxLQUFTLENBQUcsS0FBWkEsQ0FBZ0RDLEtBQUFBLENBQUFBLEtBQUFBLENBQVksZ0JBQTVERCxFQUFOLG9DQUFNQSxDQUFOO0FBRUE7O0FBS0MsUUFBQSxjQUFBLEdBQUEsTUFBQSxpQkFBQSxFQUFBOzs7QUFDRCxVQUFJRSxTQUFhQyxHQUFBQSxHQUFBQSxDQUFiRCxNQUFhQyxDQUFhSCxLQUFiRyxFQUFhSCxjQUFiRyxFQUFqQjtBQUNFLE1BQUEsVUFBVWhCLEVBQVY7QUFERixLQUFpQmdCLENBQWpCOztBQU1BLFFBQUEsU0FBT0gsQ0FBUCxHQUFBLEtBQUEsWUFBQSxFQUFBO0FBR0YsWUFBQSxJQUFBLEtBQUEsQ0FBQSxLQUFBLEMsNEJBQUEsRSxxR0FBQSxDQUFBO0FBRUU7OzRDQUlGLFMsSUFDRSxTQUFPSSxDQUFBQSxRQUFQLENBQUEsU0FBQSxDQUFBLEdBQUEsQyxFQUNEOzRCQUVNRSxLQUFBQSxDQUFQRCxLQUFPQyxDQUFVLGdCLEVBQUEsd0RBQUEsU0FBQSxDQUFBLEdBQUEsZ0JBQUEsU0FBQSxFO0FBQWpCRCIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFBhcnNlID0gcmVxdWlyZSgncGFyc2Uvbm9kZScpLlBhcnNlO1xuY29uc3QgaHR0cHNSZXF1ZXN0ID0gcmVxdWlyZSgnLi9odHRwc1JlcXVlc3QnKTtcbmNvbnN0IE5vZGVSU0EgPSByZXF1aXJlKCdub2RlLXJzYScpO1xuY29uc3Qgand0ID0gcmVxdWlyZSgnanNvbndlYnRva2VuJyk7XG5cbmNvbnN0IFRPS0VOX0lTU1VFUiA9ICdodHRwczovL2FwcGxlaWQuYXBwbGUuY29tJztcblxuY29uc3QgZ2V0QXBwbGVQdWJsaWNLZXkgPSBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGRhdGEgPSBhd2FpdCBodHRwc1JlcXVlc3QuZ2V0KCdodHRwczovL2FwcGxlaWQuYXBwbGUuY29tL2F1dGgva2V5cycpO1xuICBjb25zdCBrZXkgPSBkYXRhLmtleXNbMF07XG5cbiAgY29uc3QgcHViS2V5ID0gbmV3IE5vZGVSU0EoKTtcbiAgcHViS2V5LmltcG9ydEtleShcbiAgICB7IG46IEJ1ZmZlci5mcm9tKGtleS5uLCAnYmFzZTY0JyksIGU6IEJ1ZmZlci5mcm9tKGtleS5lLCAnYmFzZTY0JykgfSxcbiAgICAnY29tcG9uZW50cy1wdWJsaWMnXG4gICk7XG4gIHJldHVybiBwdWJLZXkuZXhwb3J0S2V5KFsncHVibGljJ10pO1xufTtcblxuY29uc3QgdmVyaWZ5SWRUb2tlbiA9IGFzeW5jICh0b2tlbiwgY2xpZW50SUQpID0+IHtcbiAgaWYgKCF0b2tlbikge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICAnaWQgdG9rZW4gaXMgaW52YWxpZCBmb3IgdGhpcyB1c2VyLidcbiAgICApO1xuICB9XG4gIGNvbnN0IGFwcGxlUHVibGljS2V5ID0gYXdhaXQgZ2V0QXBwbGVQdWJsaWNLZXkoKTtcbiAgY29uc3Qgand0Q2xhaW1zID0gand0LnZlcmlmeSh0b2tlbiwgYXBwbGVQdWJsaWNLZXksIHsgYWxnb3JpdGhtczogJ1JTMjU2JyB9KTtcblxuICBpZiAoand0Q2xhaW1zLmlzcyAhPT0gVE9LRU5fSVNTVUVSKSB7XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgUGFyc2UuRXJyb3IuT0JKRUNUX05PVF9GT1VORCxcbiAgICAgIGBpZCB0b2tlbiBub3QgaXNzdWVkIGJ5IGNvcnJlY3QgT3BlbklEIHByb3ZpZGVyIC0gZXhwZWN0ZWQ6ICR7VE9LRU5fSVNTVUVSfSB8IGZyb206ICR7and0Q2xhaW1zLmlzc31gXG4gICAgKTtcbiAgfVxuICBpZiAoY2xpZW50SUQgIT09IHVuZGVmaW5lZCAmJiBqd3RDbGFpbXMuYXVkICE9PSBjbGllbnRJRCkge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICBgand0IGF1ZCBwYXJhbWV0ZXIgZG9lcyBub3QgaW5jbHVkZSB0aGlzIGNsaWVudCAtIGlzOiAke2p3dENsYWltcy5hdWR9IHwgZXhwZWN0ZWQ6ICR7Y2xpZW50SUR9YFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIGp3dENsYWltcztcbn07XG5cbi8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgaWYgdGhpcyBpZCB0b2tlbiBpcyB2YWxpZFxuZnVuY3Rpb24gdmFsaWRhdGVBdXRoRGF0YShhdXRoRGF0YSwgb3B0aW9ucyA9IHt9KSB7XG4gIHJldHVybiB2ZXJpZnlJZFRva2VuKGF1dGhEYXRhLmlkLCBvcHRpb25zLmNsaWVudF9pZCk7XG59XG5cbi8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgaWYgdGhpcyBhcHAgaWQgaXMgdmFsaWQuXG5mdW5jdGlvbiB2YWxpZGF0ZUFwcElkKCkge1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB2YWxpZGF0ZUFwcElkLFxuICB2YWxpZGF0ZUF1dGhEYXRhLFxufTtcbiJdfQ==
