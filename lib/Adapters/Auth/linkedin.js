'use strict';

// Helper functions for accessing the linkedin API.
var https = require('https');
var Parse = require('parse/node').Parse;

// Returns a promise that fulfills iff this user id is valid.
function validateAuthData(authData) {
  return request('me', authData.access_token, authData.is_mobile_sdk).then(data => {
    if (data && data.id == authData.id) {
      return;
    }
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Linkedin auth is invalid for this user.');
  });
}

// Returns a promise that fulfills iff this app id is valid.
function validateAppId() {
  return Promise.resolve();
}

// A promisey wrapper for api requests
function request(path, access_token, is_mobile_sdk) {
  var headers = {
    'Authorization': 'Bearer ' + access_token,
    'x-li-format': 'json'
  };

  if (is_mobile_sdk) {
    headers['x-li-src'] = 'msdk';
  }

  return new Promise(function (resolve, reject) {
    https.get({
      host: 'api.linkedin.com',
      path: '/v2/' + path,
      headers: headers
    }, function (res) {
      var data = '';
      res.on('data', function (chunk) {
        data += chunk;
      });
      res.on('end', function () {
        try {
          data = JSON.parse(data);
        } catch (e) {
          return reject(e);
        }
        resolve(data);
      });
    }).on('error', function () {
      reject('Failed to validate this access token with Linkedin.');
    });
  });
}

module.exports = {
  validateAppId: validateAppId,
  validateAuthData: validateAuthData
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9BZGFwdGVycy9BdXRoL2xpbmtlZGluLmpzIl0sIm5hbWVzIjpbImh0dHBzIiwicmVxdWlyZSIsIlBhcnNlIiwidmFsaWRhdGVBdXRoRGF0YSIsImF1dGhEYXRhIiwicmVxdWVzdCIsImFjY2Vzc190b2tlbiIsImlzX21vYmlsZV9zZGsiLCJ0aGVuIiwiZGF0YSIsImlkIiwiRXJyb3IiLCJPQkpFQ1RfTk9UX0ZPVU5EIiwidmFsaWRhdGVBcHBJZCIsIlByb21pc2UiLCJyZXNvbHZlIiwicGF0aCIsImhlYWRlcnMiLCJyZWplY3QiLCJnZXQiLCJob3N0IiwicmVzIiwib24iLCJjaHVuayIsIkpTT04iLCJwYXJzZSIsImUiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0EsSUFBSUEsUUFBUUMsUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFJQyxRQUFRRCxRQUFRLFlBQVIsRUFBc0JDLEtBQWxDOztBQUVBO0FBQ0EsU0FBU0MsZ0JBQVQsQ0FBMEJDLFFBQTFCLEVBQW9DO0FBQ2xDLFNBQU9DLFFBQVEsSUFBUixFQUFjRCxTQUFTRSxZQUF2QixFQUFxQ0YsU0FBU0csYUFBOUMsRUFDSkMsSUFESSxDQUNFQyxJQUFELElBQVU7QUFDZCxRQUFJQSxRQUFRQSxLQUFLQyxFQUFMLElBQVdOLFNBQVNNLEVBQWhDLEVBQW9DO0FBQ2xDO0FBQ0Q7QUFDRCxVQUFNLElBQUlSLE1BQU1TLEtBQVYsQ0FDSlQsTUFBTVMsS0FBTixDQUFZQyxnQkFEUixFQUVKLHlDQUZJLENBQU47QUFHRCxHQVJJLENBQVA7QUFTRDs7QUFFRDtBQUNBLFNBQVNDLGFBQVQsR0FBeUI7QUFDdkIsU0FBT0MsUUFBUUMsT0FBUixFQUFQO0FBQ0Q7O0FBRUQ7QUFDQSxTQUFTVixPQUFULENBQWlCVyxJQUFqQixFQUF1QlYsWUFBdkIsRUFBcUNDLGFBQXJDLEVBQW9EO0FBQ2xELE1BQUlVLFVBQVU7QUFDWixxQkFBaUIsWUFBWVgsWUFEakI7QUFFWixtQkFBZTtBQUZILEdBQWQ7O0FBS0EsTUFBR0MsYUFBSCxFQUFrQjtBQUNoQlUsWUFBUSxVQUFSLElBQXNCLE1BQXRCO0FBQ0Q7O0FBRUQsU0FBTyxJQUFJSCxPQUFKLENBQVksVUFBU0MsT0FBVCxFQUFrQkcsTUFBbEIsRUFBMEI7QUFDM0NsQixVQUFNbUIsR0FBTixDQUFVO0FBQ1JDLFlBQU0sa0JBREU7QUFFUkosWUFBTSxTQUFTQSxJQUZQO0FBR1JDLGVBQVNBO0FBSEQsS0FBVixFQUlHLFVBQVNJLEdBQVQsRUFBYztBQUNmLFVBQUlaLE9BQU8sRUFBWDtBQUNBWSxVQUFJQyxFQUFKLENBQU8sTUFBUCxFQUFlLFVBQVNDLEtBQVQsRUFBZ0I7QUFDN0JkLGdCQUFRYyxLQUFSO0FBQ0QsT0FGRDtBQUdBRixVQUFJQyxFQUFKLENBQU8sS0FBUCxFQUFjLFlBQVc7QUFDdkIsWUFBSTtBQUNGYixpQkFBT2UsS0FBS0MsS0FBTCxDQUFXaEIsSUFBWCxDQUFQO0FBQ0QsU0FGRCxDQUVFLE9BQU1pQixDQUFOLEVBQVM7QUFDVCxpQkFBT1IsT0FBT1EsQ0FBUCxDQUFQO0FBQ0Q7QUFDRFgsZ0JBQVFOLElBQVI7QUFDRCxPQVBEO0FBUUQsS0FqQkQsRUFpQkdhLEVBakJILENBaUJNLE9BakJOLEVBaUJlLFlBQVc7QUFDeEJKLGFBQU8scURBQVA7QUFDRCxLQW5CRDtBQW9CRCxHQXJCTSxDQUFQO0FBc0JEOztBQUVEUyxPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZmLGlCQUFlQSxhQURBO0FBRWZWLG9CQUFrQkE7QUFGSCxDQUFqQiIsImZpbGUiOiJsaW5rZWRpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEhlbHBlciBmdW5jdGlvbnMgZm9yIGFjY2Vzc2luZyB0aGUgbGlua2VkaW4gQVBJLlxudmFyIGh0dHBzID0gcmVxdWlyZSgnaHR0cHMnKTtcbnZhciBQYXJzZSA9IHJlcXVpcmUoJ3BhcnNlL25vZGUnKS5QYXJzZTtcblxuLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCBmdWxmaWxscyBpZmYgdGhpcyB1c2VyIGlkIGlzIHZhbGlkLlxuZnVuY3Rpb24gdmFsaWRhdGVBdXRoRGF0YShhdXRoRGF0YSkge1xuICByZXR1cm4gcmVxdWVzdCgnbWUnLCBhdXRoRGF0YS5hY2Nlc3NfdG9rZW4sIGF1dGhEYXRhLmlzX21vYmlsZV9zZGspXG4gICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgIGlmIChkYXRhICYmIGRhdGEuaWQgPT0gYXV0aERhdGEuaWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELFxuICAgICAgICAnTGlua2VkaW4gYXV0aCBpcyBpbnZhbGlkIGZvciB0aGlzIHVzZXIuJyk7XG4gICAgfSk7XG59XG5cbi8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgaWZmIHRoaXMgYXBwIGlkIGlzIHZhbGlkLlxuZnVuY3Rpb24gdmFsaWRhdGVBcHBJZCgpIHtcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xufVxuXG4vLyBBIHByb21pc2V5IHdyYXBwZXIgZm9yIGFwaSByZXF1ZXN0c1xuZnVuY3Rpb24gcmVxdWVzdChwYXRoLCBhY2Nlc3NfdG9rZW4sIGlzX21vYmlsZV9zZGspIHtcbiAgdmFyIGhlYWRlcnMgPSB7XG4gICAgJ0F1dGhvcml6YXRpb24nOiAnQmVhcmVyICcgKyBhY2Nlc3NfdG9rZW4sXG4gICAgJ3gtbGktZm9ybWF0JzogJ2pzb24nLFxuICB9XG5cbiAgaWYoaXNfbW9iaWxlX3Nkaykge1xuICAgIGhlYWRlcnNbJ3gtbGktc3JjJ10gPSAnbXNkayc7XG4gIH1cblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgaHR0cHMuZ2V0KHtcbiAgICAgIGhvc3Q6ICdhcGkubGlua2VkaW4uY29tJyxcbiAgICAgIHBhdGg6ICcvdjIvJyArIHBhdGgsXG4gICAgICBoZWFkZXJzOiBoZWFkZXJzXG4gICAgfSwgZnVuY3Rpb24ocmVzKSB7XG4gICAgICB2YXIgZGF0YSA9ICcnO1xuICAgICAgcmVzLm9uKCdkYXRhJywgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgIH0pO1xuICAgICAgcmVzLm9uKCdlbmQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgICAgfVxuICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgfSk7XG4gICAgfSkub24oJ2Vycm9yJywgZnVuY3Rpb24oKSB7XG4gICAgICByZWplY3QoJ0ZhaWxlZCB0byB2YWxpZGF0ZSB0aGlzIGFjY2VzcyB0b2tlbiB3aXRoIExpbmtlZGluLicpO1xuICAgIH0pO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHZhbGlkYXRlQXBwSWQ6IHZhbGlkYXRlQXBwSWQsXG4gIHZhbGlkYXRlQXV0aERhdGE6IHZhbGlkYXRlQXV0aERhdGFcbn07XG4iXX0=