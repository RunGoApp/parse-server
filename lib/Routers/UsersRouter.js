'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UsersRouter = undefined;

var _node = require('parse/node');

var _node2 = _interopRequireDefault(_node);

var _Config = require('../Config');

var _Config2 = _interopRequireDefault(_Config);

var _AccountLockout = require('../AccountLockout');

var _AccountLockout2 = _interopRequireDefault(_AccountLockout);

var _ClassesRouter = require('./ClassesRouter');

var _ClassesRouter2 = _interopRequireDefault(_ClassesRouter);

var _rest = require('../rest');

var _rest2 = _interopRequireDefault(_rest);

var _Auth = require('../Auth');

var _Auth2 = _interopRequireDefault(_Auth);

var _password = require('../password');

var _password2 = _interopRequireDefault(_password);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class UsersRouter extends _ClassesRouter2.default {

  className() {
    return '_User';
  }

  /**
   * Removes all "_" prefixed properties from an object, except "__type"
   * @param {Object} obj An object.
   */
  static removeHiddenProperties(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Regexp comes from Parse.Object.prototype.validate
        if (key !== "__type" && !/^[A-Za-z][0-9A-Za-z_]*$/.test(key)) {
          delete obj[key];
        }
      }
    }
  }

  /**
   * Validates a password request in login and verifyPassword
   * @param {Object} req The request
   * @returns {Object} User object
   * @private
   */
  _authenticateUserFromRequest(req) {
    return new Promise((resolve, reject) => {
      // Use query parameters instead if provided in url
      let payload = req.body;
      if (!payload.username && req.query.username || !payload.email && req.query.email) {
        payload = req.query;
      }
      const {
        username,
        email,
        password
      } = payload;

      // TODO: use the right error codes / descriptions.
      if (!username && !email) {
        throw new _node2.default.Error(_node2.default.Error.USERNAME_MISSING, 'username/email is required.');
      }
      if (!password) {
        throw new _node2.default.Error(_node2.default.Error.PASSWORD_MISSING, 'password is required.');
      }
      if (typeof password !== 'string' || email && typeof email !== 'string' || username && typeof username !== 'string') {
        throw new _node2.default.Error(_node2.default.Error.OBJECT_NOT_FOUND, 'Invalid username/password.');
      }

      let user;
      let isValidPassword = false;
      let query;
      if (email && username) {
        query = { email, username };
      } else if (email) {
        query = { email };
      } else {
        query = { $or: [{ username }, { email: username }] };
      }
      return req.config.database.find('_User', query).then(results => {
        if (!results.length) {
          throw new _node2.default.Error(_node2.default.Error.OBJECT_NOT_FOUND, 'Invalid username/password.');
        }

        if (results.length > 1) {
          // corner case where user1 has username == user2 email
          req.config.loggerController.warn('There is a user which email is the same as another user\'s username, logging in based on username');
          user = results.filter(user => user.username === username)[0];
        } else {
          user = results[0];
        }

        return _password2.default.compare(password, user.password);
      }).then(correct => {
        isValidPassword = correct;
        const accountLockoutPolicy = new _AccountLockout2.default(user, req.config);
        return accountLockoutPolicy.handleLoginAttempt(isValidPassword);
      }).then(() => {
        if (!isValidPassword) {
          throw new _node2.default.Error(_node2.default.Error.OBJECT_NOT_FOUND, 'Invalid username/password.');
        }
        // Ensure the user isn't locked out
        // A locked out user won't be able to login
        // To lock a user out, just set the ACL to `masterKey` only  ({}).
        // Empty ACL is OK
        if (!req.auth.isMaster && user.ACL && Object.keys(user.ACL).length == 0) {
          throw new _node2.default.Error(_node2.default.Error.OBJECT_NOT_FOUND, 'Invalid username/password.');
        }
        if (req.config.verifyUserEmails && req.config.preventLoginWithUnverifiedEmail && !user.emailVerified) {
          throw new _node2.default.Error(_node2.default.Error.EMAIL_NOT_FOUND, 'User email is not verified.');
        }

        delete user.password;

        // Sometimes the authData still has null on that keys
        // https://github.com/parse-community/parse-server/issues/935
        if (user.authData) {
          Object.keys(user.authData).forEach(provider => {
            if (user.authData[provider] === null) {
              delete user.authData[provider];
            }
          });
          if (Object.keys(user.authData).length == 0) {
            delete user.authData;
          }
        }

        return resolve(user);
      }).catch(error => {
        return reject(error);
      });
    });
  }

  handleMe(req) {
    if (!req.info || !req.info.sessionToken) {
      throw new _node2.default.Error(_node2.default.Error.INVALID_SESSION_TOKEN, 'Invalid session token');
    }
    const sessionToken = req.info.sessionToken;
    return _rest2.default.find(req.config, _Auth2.default.master(req.config), '_Session', { sessionToken }, { include: 'user' }, req.info.clientSDK).then(response => {
      if (!response.results || response.results.length == 0 || !response.results[0].user) {
        throw new _node2.default.Error(_node2.default.Error.INVALID_SESSION_TOKEN, 'Invalid session token');
      } else {
        const user = response.results[0].user;
        // Send token back on the login, because SDKs expect that.
        user.sessionToken = sessionToken;

        // Remove hidden properties.
        UsersRouter.removeHiddenProperties(user);

        return { response: user };
      }
    });
  }

  handleLogIn(req) {
    // Use query parameters instead if provided in url
    let payload = req.body;
    if (!payload.username && req.query.username || !payload.email && req.query.email) {
      payload = req.query;
    }
    var {
      username,
      email,
      password
    } = payload;

    username = payload.username.toLowerCase();

    // TODO: use the right error codes / descriptions.
    if (!username && !email) {
      throw new _node2.default.Error(_node2.default.Error.USERNAME_MISSING, 'username/email is required.');
    }
    if (!password) {
      throw new _node2.default.Error(_node2.default.Error.PASSWORD_MISSING, 'password is required.');
    }
    if (typeof password !== 'string' || email && typeof email !== 'string' || username && typeof username !== 'string') {
      throw new _node2.default.Error(_node2.default.Error.OBJECT_NOT_FOUND, 'Invalid username/password.');
    }

    let user;
    return this._authenticateUserFromRequest(req).then(res => {

      user = res;

      // handle password expiry policy
      if (req.config.passwordPolicy && req.config.passwordPolicy.maxPasswordAge) {
        let changedAt = user._password_changed_at;

        if (!changedAt) {
          // password was created before expiry policy was enabled.
          // simply update _User object so that it will start enforcing from now
          changedAt = new Date();
          req.config.database.update('_User', { username: user.username }, { _password_changed_at: _node2.default._encode(changedAt) });
        } else {
          // check whether the password has expired
          if (changedAt.__type == 'Date') {
            changedAt = new Date(changedAt.iso);
          }
          // Calculate the expiry time.
          const expiresAt = new Date(changedAt.getTime() + 86400000 * req.config.passwordPolicy.maxPasswordAge);
          if (expiresAt < new Date()) // fail of current time is past password expiry time
            throw new _node2.default.Error(_node2.default.Error.OBJECT_NOT_FOUND, 'Your password has expired. Please reset your password.');
        }
      }

      // Remove hidden properties.
      UsersRouter.removeHiddenProperties(user);

      const {
        sessionData,
        createSession
      } = _Auth2.default.createSession(req.config, {
        userId: user.objectId, createdWith: {
          'action': 'login',
          'authProvider': 'password'
        }, installationId: req.info.installationId
      });

      user.sessionToken = sessionData.sessionToken;

      req.config.filesController.expandFilesInObject(req.config, user);

      return createSession();
    }).then(() => {
      return { response: user };
    });
  }

  handleVerifyPassword(req) {
    return this._authenticateUserFromRequest(req).then(user => {

      // Remove hidden properties.
      UsersRouter.removeHiddenProperties(user);

      return { response: user };
    }).catch(error => {
      throw error;
    });
  }

  handleLogOut(req) {
    const success = { response: {} };
    if (req.info && req.info.sessionToken) {
      return _rest2.default.find(req.config, _Auth2.default.master(req.config), '_Session', { sessionToken: req.info.sessionToken }, undefined, req.info.clientSDK).then(records => {
        if (records.results && records.results.length) {
          return _rest2.default.del(req.config, _Auth2.default.master(req.config), '_Session', records.results[0].objectId).then(() => {
            return Promise.resolve(success);
          });
        }
        return Promise.resolve(success);
      });
    }
    return Promise.resolve(success);
  }

  _throwOnBadEmailConfig(req) {
    try {
      _Config2.default.validateEmailConfiguration({
        emailAdapter: req.config.userController.adapter,
        appName: req.config.appName,
        publicServerURL: req.config.publicServerURL,
        emailVerifyTokenValidityDuration: req.config.emailVerifyTokenValidityDuration
      });
    } catch (e) {
      if (typeof e === 'string') {
        // Maybe we need a Bad Configuration error, but the SDKs won't understand it. For now, Internal Server Error.
        throw new _node2.default.Error(_node2.default.Error.INTERNAL_SERVER_ERROR, 'An appName, publicServerURL, and emailAdapter are required for password reset and email verification functionality.');
      } else {
        throw e;
      }
    }
  }

  handleResetRequest(req) {
    this._throwOnBadEmailConfig(req);

    const { email } = req.body;
    if (!email) {
      throw new _node2.default.Error(_node2.default.Error.EMAIL_MISSING, "you must provide an email");
    }
    if (typeof email !== 'string') {
      throw new _node2.default.Error(_node2.default.Error.INVALID_EMAIL_ADDRESS, 'you must provide a valid email string');
    }
    const userController = req.config.userController;
    return userController.sendPasswordResetEmail(email).then(() => {
      return Promise.resolve({
        response: {}
      });
    }, err => {
      if (err.code === _node2.default.Error.OBJECT_NOT_FOUND) {
        throw new _node2.default.Error(_node2.default.Error.EMAIL_NOT_FOUND, `No user found with email ${email}.`);
      } else {
        throw err;
      }
    });
  }

  handleVerificationEmailRequest(req) {
    this._throwOnBadEmailConfig(req);

    const { email } = req.body;
    if (!email) {
      throw new _node2.default.Error(_node2.default.Error.EMAIL_MISSING, 'you must provide an email');
    }
    if (typeof email !== 'string') {
      throw new _node2.default.Error(_node2.default.Error.INVALID_EMAIL_ADDRESS, 'you must provide a valid email string');
    }

    return req.config.database.find('_User', { email: email }).then(results => {
      if (!results.length || results.length < 1) {
        throw new _node2.default.Error(_node2.default.Error.EMAIL_NOT_FOUND, `No user found with email ${email}`);
      }
      const user = results[0];

      // remove password field, messes with saving on postgres
      delete user.password;

      if (user.emailVerified) {
        throw new _node2.default.Error(_node2.default.Error.OTHER_CAUSE, `Email ${email} is already verified.`);
      }

      const userController = req.config.userController;
      return userController.regenerateEmailVerifyToken(user).then(() => {
        userController.sendVerificationEmail(user);
        return { response: {} };
      });
    });
  }

  mountRoutes() {
    this.route('GET', '/users', req => {
      return this.handleFind(req);
    });
    this.route('POST', '/users', req => {
      return this.handleCreate(req);
    });
    this.route('GET', '/users/me', req => {
      return this.handleMe(req);
    });
    this.route('GET', '/users/:objectId', req => {
      return this.handleGet(req);
    });
    this.route('PUT', '/users/:objectId', req => {
      return this.handleUpdate(req);
    });
    this.route('DELETE', '/users/:objectId', req => {
      return this.handleDelete(req);
    });
    this.route('GET', '/login', req => {
      return this.handleLogIn(req);
    });
    this.route('POST', '/login', req => {
      return this.handleLogIn(req);
    });
    this.route('POST', '/logout', req => {
      return this.handleLogOut(req);
    });
    this.route('POST', '/requestPasswordReset', req => {
      return this.handleResetRequest(req);
    });
    this.route('POST', '/verificationEmailRequest', req => {
      return this.handleVerificationEmailRequest(req);
    });
    this.route('GET', '/verifyPassword', req => {
      return this.handleVerifyPassword(req);
    });
  }
}

exports.UsersRouter = UsersRouter; // These methods handle the User-related routes.

exports.default = UsersRouter;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Sb3V0ZXJzL1VzZXJzUm91dGVyLmpzIl0sIm5hbWVzIjpbIlVzZXJzUm91dGVyIiwiQ2xhc3Nlc1JvdXRlciIsImNsYXNzTmFtZSIsInJlbW92ZUhpZGRlblByb3BlcnRpZXMiLCJvYmoiLCJrZXkiLCJoYXNPd25Qcm9wZXJ0eSIsInRlc3QiLCJfYXV0aGVudGljYXRlVXNlckZyb21SZXF1ZXN0IiwicmVxIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJwYXlsb2FkIiwiYm9keSIsInVzZXJuYW1lIiwicXVlcnkiLCJlbWFpbCIsInBhc3N3b3JkIiwiUGFyc2UiLCJFcnJvciIsIlVTRVJOQU1FX01JU1NJTkciLCJQQVNTV09SRF9NSVNTSU5HIiwiT0JKRUNUX05PVF9GT1VORCIsInVzZXIiLCJpc1ZhbGlkUGFzc3dvcmQiLCIkb3IiLCJjb25maWciLCJkYXRhYmFzZSIsImZpbmQiLCJ0aGVuIiwicmVzdWx0cyIsImxlbmd0aCIsImxvZ2dlckNvbnRyb2xsZXIiLCJ3YXJuIiwiZmlsdGVyIiwicGFzc3dvcmRDcnlwdG8iLCJjb21wYXJlIiwiY29ycmVjdCIsImFjY291bnRMb2Nrb3V0UG9saWN5IiwiQWNjb3VudExvY2tvdXQiLCJoYW5kbGVMb2dpbkF0dGVtcHQiLCJhdXRoIiwiaXNNYXN0ZXIiLCJBQ0wiLCJPYmplY3QiLCJrZXlzIiwidmVyaWZ5VXNlckVtYWlscyIsInByZXZlbnRMb2dpbldpdGhVbnZlcmlmaWVkRW1haWwiLCJlbWFpbFZlcmlmaWVkIiwiRU1BSUxfTk9UX0ZPVU5EIiwiYXV0aERhdGEiLCJmb3JFYWNoIiwicHJvdmlkZXIiLCJjYXRjaCIsImVycm9yIiwiaGFuZGxlTWUiLCJpbmZvIiwic2Vzc2lvblRva2VuIiwiSU5WQUxJRF9TRVNTSU9OX1RPS0VOIiwicmVzdCIsIkF1dGgiLCJtYXN0ZXIiLCJpbmNsdWRlIiwiY2xpZW50U0RLIiwicmVzcG9uc2UiLCJoYW5kbGVMb2dJbiIsInRvTG93ZXJDYXNlIiwicmVzIiwicGFzc3dvcmRQb2xpY3kiLCJtYXhQYXNzd29yZEFnZSIsImNoYW5nZWRBdCIsIl9wYXNzd29yZF9jaGFuZ2VkX2F0IiwiRGF0ZSIsInVwZGF0ZSIsIl9lbmNvZGUiLCJfX3R5cGUiLCJpc28iLCJleHBpcmVzQXQiLCJnZXRUaW1lIiwic2Vzc2lvbkRhdGEiLCJjcmVhdGVTZXNzaW9uIiwidXNlcklkIiwib2JqZWN0SWQiLCJjcmVhdGVkV2l0aCIsImluc3RhbGxhdGlvbklkIiwiZmlsZXNDb250cm9sbGVyIiwiZXhwYW5kRmlsZXNJbk9iamVjdCIsImhhbmRsZVZlcmlmeVBhc3N3b3JkIiwiaGFuZGxlTG9nT3V0Iiwic3VjY2VzcyIsInVuZGVmaW5lZCIsInJlY29yZHMiLCJkZWwiLCJfdGhyb3dPbkJhZEVtYWlsQ29uZmlnIiwiQ29uZmlnIiwidmFsaWRhdGVFbWFpbENvbmZpZ3VyYXRpb24iLCJlbWFpbEFkYXB0ZXIiLCJ1c2VyQ29udHJvbGxlciIsImFkYXB0ZXIiLCJhcHBOYW1lIiwicHVibGljU2VydmVyVVJMIiwiZW1haWxWZXJpZnlUb2tlblZhbGlkaXR5RHVyYXRpb24iLCJlIiwiSU5URVJOQUxfU0VSVkVSX0VSUk9SIiwiaGFuZGxlUmVzZXRSZXF1ZXN0IiwiRU1BSUxfTUlTU0lORyIsIklOVkFMSURfRU1BSUxfQUREUkVTUyIsInNlbmRQYXNzd29yZFJlc2V0RW1haWwiLCJlcnIiLCJjb2RlIiwiaGFuZGxlVmVyaWZpY2F0aW9uRW1haWxSZXF1ZXN0IiwiT1RIRVJfQ0FVU0UiLCJyZWdlbmVyYXRlRW1haWxWZXJpZnlUb2tlbiIsInNlbmRWZXJpZmljYXRpb25FbWFpbCIsIm1vdW50Um91dGVzIiwicm91dGUiLCJoYW5kbGVGaW5kIiwiaGFuZGxlQ3JlYXRlIiwiaGFuZGxlR2V0IiwiaGFuZGxlVXBkYXRlIiwiaGFuZGxlRGVsZXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztB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QUFXLE1BQVgsRUFBbUIsUUFBbkIsRUFBNkIzRyxPQUFPO0FBQUUsYUFBTyxLQUFLeUQsV0FBTCxDQUFpQnpELEdBQWpCLENBQVA7QUFBK0IsS0FBckU7QUFDQSxTQUFLMkcsS0FBTCxDQUFXLE1BQVgsRUFBbUIsU0FBbkIsRUFBOEIzRyxPQUFPO0FBQUUsYUFBTyxLQUFLZ0YsWUFBTCxDQUFrQmhGLEdBQWxCLENBQVA7QUFBZ0MsS0FBdkU7QUFDQSxTQUFLMkcsS0FBTCxDQUFXLE1BQVgsRUFBbUIsdUJBQW5CLEVBQTRDM0csT0FBTztBQUFFLGFBQU8sS0FBS2dHLGtCQUFMLENBQXdCaEcsR0FBeEIsQ0FBUDtBQUFzQyxLQUEzRjtBQUNBLFNBQUsyRyxLQUFMLENBQVcsTUFBWCxFQUFtQiwyQkFBbkIsRUFBZ0QzRyxPQUFPO0FBQUUsYUFBTyxLQUFLc0csOEJBQUwsQ0FBb0N0RyxHQUFwQyxDQUFQO0FBQWtELEtBQTNHO0FBQ0EsU0FBSzJHLEtBQUwsQ0FBVyxLQUFYLEVBQWtCLGlCQUFsQixFQUFxQzNHLE9BQU87QUFBRSxhQUFPLEtBQUsrRSxvQkFBTCxDQUEwQi9FLEdBQTFCLENBQVA7QUFBd0MsS0FBdEY7QUFDRDtBQXpWNEM7O1FBQWxDVCxXLEdBQUFBLFcsRUFWYjs7a0JBc1dlQSxXIiwiZmlsZSI6IlVzZXJzUm91dGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gVGhlc2UgbWV0aG9kcyBoYW5kbGUgdGhlIFVzZXItcmVsYXRlZCByb3V0ZXMuXG5cbmltcG9ydCBQYXJzZSBmcm9tICdwYXJzZS9ub2RlJztcbmltcG9ydCBDb25maWcgZnJvbSAnLi4vQ29uZmlnJztcbmltcG9ydCBBY2NvdW50TG9ja291dCBmcm9tICcuLi9BY2NvdW50TG9ja291dCc7XG5pbXBvcnQgQ2xhc3Nlc1JvdXRlciBmcm9tICcuL0NsYXNzZXNSb3V0ZXInO1xuaW1wb3J0IHJlc3QgZnJvbSAnLi4vcmVzdCc7XG5pbXBvcnQgQXV0aCBmcm9tICcuLi9BdXRoJztcbmltcG9ydCBwYXNzd29yZENyeXB0byBmcm9tICcuLi9wYXNzd29yZCc7XG5cbmV4cG9ydCBjbGFzcyBVc2Vyc1JvdXRlciBleHRlbmRzIENsYXNzZXNSb3V0ZXIge1xuXG4gIGNsYXNzTmFtZSgpIHtcbiAgICByZXR1cm4gJ19Vc2VyJztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGFsbCBcIl9cIiBwcmVmaXhlZCBwcm9wZXJ0aWVzIGZyb20gYW4gb2JqZWN0LCBleGNlcHQgXCJfX3R5cGVcIlxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIEFuIG9iamVjdC5cbiAgICovXG4gIHN0YXRpYyByZW1vdmVIaWRkZW5Qcm9wZXJ0aWVzKG9iaikge1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAvLyBSZWdleHAgY29tZXMgZnJvbSBQYXJzZS5PYmplY3QucHJvdG90eXBlLnZhbGlkYXRlXG4gICAgICAgIGlmIChrZXkgIT09IFwiX190eXBlXCIgJiYgISgvXltBLVphLXpdWzAtOUEtWmEtel9dKiQvKS50ZXN0KGtleSkpIHtcbiAgICAgICAgICBkZWxldGUgb2JqW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVmFsaWRhdGVzIGEgcGFzc3dvcmQgcmVxdWVzdCBpbiBsb2dpbiBhbmQgdmVyaWZ5UGFzc3dvcmRcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlcSBUaGUgcmVxdWVzdFxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBVc2VyIG9iamVjdFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2F1dGhlbnRpY2F0ZVVzZXJGcm9tUmVxdWVzdChyZXEpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgLy8gVXNlIHF1ZXJ5IHBhcmFtZXRlcnMgaW5zdGVhZCBpZiBwcm92aWRlZCBpbiB1cmxcbiAgICAgIGxldCBwYXlsb2FkID0gcmVxLmJvZHk7XG4gICAgICBpZiAoIXBheWxvYWQudXNlcm5hbWUgJiYgcmVxLnF1ZXJ5LnVzZXJuYW1lIHx8ICFwYXlsb2FkLmVtYWlsICYmIHJlcS5xdWVyeS5lbWFpbCkge1xuICAgICAgICBwYXlsb2FkID0gcmVxLnF1ZXJ5O1xuICAgICAgfVxuICAgICAgY29uc3Qge1xuICAgICAgICB1c2VybmFtZSxcbiAgICAgICAgZW1haWwsXG4gICAgICAgIHBhc3N3b3JkLFxuICAgICAgfSA9IHBheWxvYWQ7XG5cbiAgICAgIC8vIFRPRE86IHVzZSB0aGUgcmlnaHQgZXJyb3IgY29kZXMgLyBkZXNjcmlwdGlvbnMuXG4gICAgICBpZiAoIXVzZXJuYW1lICYmICFlbWFpbCkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuVVNFUk5BTUVfTUlTU0lORywgJ3VzZXJuYW1lL2VtYWlsIGlzIHJlcXVpcmVkLicpO1xuICAgICAgfVxuICAgICAgaWYgKCFwYXNzd29yZCkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuUEFTU1dPUkRfTUlTU0lORywgJ3Bhc3N3b3JkIGlzIHJlcXVpcmVkLicpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBwYXNzd29yZCAhPT0gJ3N0cmluZydcbiAgICAgICAgfHwgZW1haWwgJiYgdHlwZW9mIGVtYWlsICE9PSAnc3RyaW5nJ1xuICAgICAgICB8fCB1c2VybmFtZSAmJiB0eXBlb2YgdXNlcm5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnSW52YWxpZCB1c2VybmFtZS9wYXNzd29yZC4nKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHVzZXI7XG4gICAgICBsZXQgaXNWYWxpZFBhc3N3b3JkID0gZmFsc2U7XG4gICAgICBsZXQgcXVlcnk7XG4gICAgICBpZiAoZW1haWwgJiYgdXNlcm5hbWUpIHtcbiAgICAgICAgcXVlcnkgPSB7IGVtYWlsLCB1c2VybmFtZSB9O1xuICAgICAgfSBlbHNlIGlmIChlbWFpbCkge1xuICAgICAgICBxdWVyeSA9IHsgZW1haWwgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5ID0geyAkb3I6IFt7IHVzZXJuYW1lIH0sIHsgZW1haWw6IHVzZXJuYW1lIH1dIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVxLmNvbmZpZy5kYXRhYmFzZS5maW5kKCdfVXNlcicsIHF1ZXJ5KVxuICAgICAgICAudGhlbigocmVzdWx0cykgPT4ge1xuICAgICAgICAgIGlmICghcmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnSW52YWxpZCB1c2VybmFtZS9wYXNzd29yZC4nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGggPiAxKSB7IC8vIGNvcm5lciBjYXNlIHdoZXJlIHVzZXIxIGhhcyB1c2VybmFtZSA9PSB1c2VyMiBlbWFpbFxuICAgICAgICAgICAgcmVxLmNvbmZpZy5sb2dnZXJDb250cm9sbGVyLndhcm4oJ1RoZXJlIGlzIGEgdXNlciB3aGljaCBlbWFpbCBpcyB0aGUgc2FtZSBhcyBhbm90aGVyIHVzZXJcXCdzIHVzZXJuYW1lLCBsb2dnaW5nIGluIGJhc2VkIG9uIHVzZXJuYW1lJyk7XG4gICAgICAgICAgICB1c2VyID0gcmVzdWx0cy5maWx0ZXIoKHVzZXIpID0+IHVzZXIudXNlcm5hbWUgPT09IHVzZXJuYW1lKVswXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXNlciA9IHJlc3VsdHNbMF07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHBhc3N3b3JkQ3J5cHRvLmNvbXBhcmUocGFzc3dvcmQsIHVzZXIucGFzc3dvcmQpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbigoY29ycmVjdCkgPT4ge1xuICAgICAgICAgIGlzVmFsaWRQYXNzd29yZCA9IGNvcnJlY3Q7XG4gICAgICAgICAgY29uc3QgYWNjb3VudExvY2tvdXRQb2xpY3kgPSBuZXcgQWNjb3VudExvY2tvdXQodXNlciwgcmVxLmNvbmZpZyk7XG4gICAgICAgICAgcmV0dXJuIGFjY291bnRMb2Nrb3V0UG9saWN5LmhhbmRsZUxvZ2luQXR0ZW1wdChpc1ZhbGlkUGFzc3dvcmQpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgaWYgKCFpc1ZhbGlkUGFzc3dvcmQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnSW52YWxpZCB1c2VybmFtZS9wYXNzd29yZC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gRW5zdXJlIHRoZSB1c2VyIGlzbid0IGxvY2tlZCBvdXRcbiAgICAgICAgICAvLyBBIGxvY2tlZCBvdXQgdXNlciB3b24ndCBiZSBhYmxlIHRvIGxvZ2luXG4gICAgICAgICAgLy8gVG8gbG9jayBhIHVzZXIgb3V0LCBqdXN0IHNldCB0aGUgQUNMIHRvIGBtYXN0ZXJLZXlgIG9ubHkgICh7fSkuXG4gICAgICAgICAgLy8gRW1wdHkgQUNMIGlzIE9LXG4gICAgICAgICAgaWYgKCFyZXEuYXV0aC5pc01hc3RlciAmJiB1c2VyLkFDTCAmJiBPYmplY3Qua2V5cyh1c2VyLkFDTCkubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnSW52YWxpZCB1c2VybmFtZS9wYXNzd29yZC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHJlcS5jb25maWcudmVyaWZ5VXNlckVtYWlscyAmJiByZXEuY29uZmlnLnByZXZlbnRMb2dpbldpdGhVbnZlcmlmaWVkRW1haWwgJiYgIXVzZXIuZW1haWxWZXJpZmllZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLkVNQUlMX05PVF9GT1VORCwgJ1VzZXIgZW1haWwgaXMgbm90IHZlcmlmaWVkLicpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGRlbGV0ZSB1c2VyLnBhc3N3b3JkO1xuXG4gICAgICAgICAgLy8gU29tZXRpbWVzIHRoZSBhdXRoRGF0YSBzdGlsbCBoYXMgbnVsbCBvbiB0aGF0IGtleXNcbiAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGFyc2UtY29tbXVuaXR5L3BhcnNlLXNlcnZlci9pc3N1ZXMvOTM1XG4gICAgICAgICAgaWYgKHVzZXIuYXV0aERhdGEpIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHVzZXIuYXV0aERhdGEpLmZvckVhY2goKHByb3ZpZGVyKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh1c2VyLmF1dGhEYXRhW3Byb3ZpZGVyXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB1c2VyLmF1dGhEYXRhW3Byb3ZpZGVyXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXModXNlci5hdXRoRGF0YSkubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgICAgZGVsZXRlIHVzZXIuYXV0aERhdGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUodXNlcik7XG4gICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGhhbmRsZU1lKHJlcSkge1xuICAgIGlmICghcmVxLmluZm8gfHwgIXJlcS5pbmZvLnNlc3Npb25Ub2tlbikge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfU0VTU0lPTl9UT0tFTiwgJ0ludmFsaWQgc2Vzc2lvbiB0b2tlbicpO1xuICAgIH1cbiAgICBjb25zdCBzZXNzaW9uVG9rZW4gPSByZXEuaW5mby5zZXNzaW9uVG9rZW47XG4gICAgcmV0dXJuIHJlc3QuZmluZChyZXEuY29uZmlnLCBBdXRoLm1hc3RlcihyZXEuY29uZmlnKSwgJ19TZXNzaW9uJyxcbiAgICAgIHsgc2Vzc2lvblRva2VuIH0sXG4gICAgICB7IGluY2x1ZGU6ICd1c2VyJyB9LCByZXEuaW5mby5jbGllbnRTREspXG4gICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgaWYgKCFyZXNwb25zZS5yZXN1bHRzIHx8XG4gICAgICAgICAgcmVzcG9uc2UucmVzdWx0cy5sZW5ndGggPT0gMCB8fFxuICAgICAgICAgICFyZXNwb25zZS5yZXN1bHRzWzBdLnVzZXIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9TRVNTSU9OX1RPS0VOLCAnSW52YWxpZCBzZXNzaW9uIHRva2VuJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdXNlciA9IHJlc3BvbnNlLnJlc3VsdHNbMF0udXNlcjtcbiAgICAgICAgICAvLyBTZW5kIHRva2VuIGJhY2sgb24gdGhlIGxvZ2luLCBiZWNhdXNlIFNES3MgZXhwZWN0IHRoYXQuXG4gICAgICAgICAgdXNlci5zZXNzaW9uVG9rZW4gPSBzZXNzaW9uVG9rZW47XG5cbiAgICAgICAgICAvLyBSZW1vdmUgaGlkZGVuIHByb3BlcnRpZXMuXG4gICAgICAgICAgVXNlcnNSb3V0ZXIucmVtb3ZlSGlkZGVuUHJvcGVydGllcyh1c2VyKTtcblxuICAgICAgICAgIHJldHVybiB7IHJlc3BvbnNlOiB1c2VyIH07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgaGFuZGxlTG9nSW4ocmVxKSB7XG4gICAgLy8gVXNlIHF1ZXJ5IHBhcmFtZXRlcnMgaW5zdGVhZCBpZiBwcm92aWRlZCBpbiB1cmxcbiAgICBsZXQgcGF5bG9hZCA9IHJlcS5ib2R5O1xuICAgIGlmICghcGF5bG9hZC51c2VybmFtZSAmJiByZXEucXVlcnkudXNlcm5hbWUgfHwgIXBheWxvYWQuZW1haWwgJiYgcmVxLnF1ZXJ5LmVtYWlsKSB7XG4gICAgICBwYXlsb2FkID0gcmVxLnF1ZXJ5O1xuICAgIH1cbiAgICB2YXIge1xuICAgICAgdXNlcm5hbWUsXG4gICAgICBlbWFpbCxcbiAgICAgIHBhc3N3b3JkLFxuICAgIH0gPSBwYXlsb2FkO1xuXG4gICAgdXNlcm5hbWUgPSBwYXlsb2FkLnVzZXJuYW1lLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAvLyBUT0RPOiB1c2UgdGhlIHJpZ2h0IGVycm9yIGNvZGVzIC8gZGVzY3JpcHRpb25zLlxuICAgIGlmICghdXNlcm5hbWUgJiYgIWVtYWlsKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuVVNFUk5BTUVfTUlTU0lORywgJ3VzZXJuYW1lL2VtYWlsIGlzIHJlcXVpcmVkLicpO1xuICAgIH1cbiAgICBpZiAoIXBhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuUEFTU1dPUkRfTUlTU0lORywgJ3Bhc3N3b3JkIGlzIHJlcXVpcmVkLicpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHBhc3N3b3JkICE9PSAnc3RyaW5nJ1xuICAgICAgICB8fCBlbWFpbCAmJiB0eXBlb2YgZW1haWwgIT09ICdzdHJpbmcnXG4gICAgICAgIHx8IHVzZXJuYW1lICYmIHR5cGVvZiB1c2VybmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnSW52YWxpZCB1c2VybmFtZS9wYXNzd29yZC4nKTtcbiAgICB9XG5cbiAgICBsZXQgdXNlcjtcbiAgICByZXR1cm4gdGhpcy5fYXV0aGVudGljYXRlVXNlckZyb21SZXF1ZXN0KHJlcSlcbiAgICAgIC50aGVuKChyZXMpID0+IHtcblxuICAgICAgICB1c2VyID0gcmVzO1xuXG4gICAgICAgIC8vIGhhbmRsZSBwYXNzd29yZCBleHBpcnkgcG9saWN5XG4gICAgICAgIGlmIChyZXEuY29uZmlnLnBhc3N3b3JkUG9saWN5ICYmIHJlcS5jb25maWcucGFzc3dvcmRQb2xpY3kubWF4UGFzc3dvcmRBZ2UpIHtcbiAgICAgICAgICBsZXQgY2hhbmdlZEF0ID0gdXNlci5fcGFzc3dvcmRfY2hhbmdlZF9hdDtcblxuICAgICAgICAgIGlmICghY2hhbmdlZEF0KSB7XG4gICAgICAgICAgICAvLyBwYXNzd29yZCB3YXMgY3JlYXRlZCBiZWZvcmUgZXhwaXJ5IHBvbGljeSB3YXMgZW5hYmxlZC5cbiAgICAgICAgICAgIC8vIHNpbXBseSB1cGRhdGUgX1VzZXIgb2JqZWN0IHNvIHRoYXQgaXQgd2lsbCBzdGFydCBlbmZvcmNpbmcgZnJvbSBub3dcbiAgICAgICAgICAgIGNoYW5nZWRBdCA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICByZXEuY29uZmlnLmRhdGFiYXNlLnVwZGF0ZSgnX1VzZXInLCB7IHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lIH0sXG4gICAgICAgICAgICAgIHsgX3Bhc3N3b3JkX2NoYW5nZWRfYXQ6IFBhcnNlLl9lbmNvZGUoY2hhbmdlZEF0KSB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2hlY2sgd2hldGhlciB0aGUgcGFzc3dvcmQgaGFzIGV4cGlyZWRcbiAgICAgICAgICAgIGlmIChjaGFuZ2VkQXQuX190eXBlID09ICdEYXRlJykge1xuICAgICAgICAgICAgICBjaGFuZ2VkQXQgPSBuZXcgRGF0ZShjaGFuZ2VkQXQuaXNvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgZXhwaXJ5IHRpbWUuXG4gICAgICAgICAgICBjb25zdCBleHBpcmVzQXQgPSBuZXcgRGF0ZShjaGFuZ2VkQXQuZ2V0VGltZSgpICsgODY0MDAwMDAgKiByZXEuY29uZmlnLnBhc3N3b3JkUG9saWN5Lm1heFBhc3N3b3JkQWdlKTtcbiAgICAgICAgICAgIGlmIChleHBpcmVzQXQgPCBuZXcgRGF0ZSgpKSAvLyBmYWlsIG9mIGN1cnJlbnQgdGltZSBpcyBwYXN0IHBhc3N3b3JkIGV4cGlyeSB0aW1lXG4gICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnWW91ciBwYXNzd29yZCBoYXMgZXhwaXJlZC4gUGxlYXNlIHJlc2V0IHlvdXIgcGFzc3dvcmQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIGhpZGRlbiBwcm9wZXJ0aWVzLlxuICAgICAgICBVc2Vyc1JvdXRlci5yZW1vdmVIaWRkZW5Qcm9wZXJ0aWVzKHVzZXIpO1xuXG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBzZXNzaW9uRGF0YSxcbiAgICAgICAgICBjcmVhdGVTZXNzaW9uXG4gICAgICAgIH0gPSBBdXRoLmNyZWF0ZVNlc3Npb24ocmVxLmNvbmZpZywge1xuICAgICAgICAgIHVzZXJJZDogdXNlci5vYmplY3RJZCwgY3JlYXRlZFdpdGg6IHtcbiAgICAgICAgICAgICdhY3Rpb24nOiAnbG9naW4nLFxuICAgICAgICAgICAgJ2F1dGhQcm92aWRlcic6ICdwYXNzd29yZCdcbiAgICAgICAgICB9LCBpbnN0YWxsYXRpb25JZDogcmVxLmluZm8uaW5zdGFsbGF0aW9uSWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdXNlci5zZXNzaW9uVG9rZW4gPSBzZXNzaW9uRGF0YS5zZXNzaW9uVG9rZW47XG5cbiAgICAgICAgcmVxLmNvbmZpZy5maWxlc0NvbnRyb2xsZXIuZXhwYW5kRmlsZXNJbk9iamVjdChyZXEuY29uZmlnLCB1c2VyKTtcblxuICAgICAgICByZXR1cm4gY3JlYXRlU2Vzc2lvbigpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHsgcmVzcG9uc2U6IHVzZXIgfTtcbiAgICAgIH0pO1xuICB9XG5cbiAgaGFuZGxlVmVyaWZ5UGFzc3dvcmQocmVxKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dGhlbnRpY2F0ZVVzZXJGcm9tUmVxdWVzdChyZXEpXG4gICAgICAudGhlbigodXNlcikgPT4ge1xuXG4gICAgICAgIC8vIFJlbW92ZSBoaWRkZW4gcHJvcGVydGllcy5cbiAgICAgICAgVXNlcnNSb3V0ZXIucmVtb3ZlSGlkZGVuUHJvcGVydGllcyh1c2VyKTtcblxuICAgICAgICByZXR1cm4geyByZXNwb25zZTogdXNlciB9O1xuICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSk7XG4gIH1cblxuICBoYW5kbGVMb2dPdXQocmVxKSB7XG4gICAgY29uc3Qgc3VjY2VzcyA9IHsgcmVzcG9uc2U6IHt9IH07XG4gICAgaWYgKHJlcS5pbmZvICYmIHJlcS5pbmZvLnNlc3Npb25Ub2tlbikge1xuICAgICAgcmV0dXJuIHJlc3QuZmluZChyZXEuY29uZmlnLCBBdXRoLm1hc3RlcihyZXEuY29uZmlnKSwgJ19TZXNzaW9uJyxcbiAgICAgICAgeyBzZXNzaW9uVG9rZW46IHJlcS5pbmZvLnNlc3Npb25Ub2tlbiB9LCB1bmRlZmluZWQsIHJlcS5pbmZvLmNsaWVudFNES1xuICAgICAgKS50aGVuKChyZWNvcmRzKSA9PiB7XG4gICAgICAgIGlmIChyZWNvcmRzLnJlc3VsdHMgJiYgcmVjb3Jkcy5yZXN1bHRzLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiByZXN0LmRlbChyZXEuY29uZmlnLCBBdXRoLm1hc3RlcihyZXEuY29uZmlnKSwgJ19TZXNzaW9uJyxcbiAgICAgICAgICAgIHJlY29yZHMucmVzdWx0c1swXS5vYmplY3RJZFxuICAgICAgICAgICkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHN1Y2Nlc3MpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShzdWNjZXNzKTtcbiAgfVxuXG4gIF90aHJvd09uQmFkRW1haWxDb25maWcocmVxKSB7XG4gICAgdHJ5IHtcbiAgICAgIENvbmZpZy52YWxpZGF0ZUVtYWlsQ29uZmlndXJhdGlvbih7XG4gICAgICAgIGVtYWlsQWRhcHRlcjogcmVxLmNvbmZpZy51c2VyQ29udHJvbGxlci5hZGFwdGVyLFxuICAgICAgICBhcHBOYW1lOiByZXEuY29uZmlnLmFwcE5hbWUsXG4gICAgICAgIHB1YmxpY1NlcnZlclVSTDogcmVxLmNvbmZpZy5wdWJsaWNTZXJ2ZXJVUkwsXG4gICAgICAgIGVtYWlsVmVyaWZ5VG9rZW5WYWxpZGl0eUR1cmF0aW9uOiByZXEuY29uZmlnLmVtYWlsVmVyaWZ5VG9rZW5WYWxpZGl0eUR1cmF0aW9uXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAodHlwZW9mIGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIE1heWJlIHdlIG5lZWQgYSBCYWQgQ29uZmlndXJhdGlvbiBlcnJvciwgYnV0IHRoZSBTREtzIHdvbid0IHVuZGVyc3RhbmQgaXQuIEZvciBub3csIEludGVybmFsIFNlcnZlciBFcnJvci5cbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVEVSTkFMX1NFUlZFUl9FUlJPUiwgJ0FuIGFwcE5hbWUsIHB1YmxpY1NlcnZlclVSTCwgYW5kIGVtYWlsQWRhcHRlciBhcmUgcmVxdWlyZWQgZm9yIHBhc3N3b3JkIHJlc2V0IGFuZCBlbWFpbCB2ZXJpZmljYXRpb24gZnVuY3Rpb25hbGl0eS4nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlUmVzZXRSZXF1ZXN0KHJlcSkge1xuICAgIHRoaXMuX3Rocm93T25CYWRFbWFpbENvbmZpZyhyZXEpO1xuXG4gICAgY29uc3QgeyBlbWFpbCB9ID0gcmVxLmJvZHk7XG4gICAgaWYgKCFlbWFpbCkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLkVNQUlMX01JU1NJTkcsIFwieW91IG11c3QgcHJvdmlkZSBhbiBlbWFpbFwiKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbWFpbCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0VNQUlMX0FERFJFU1MsICd5b3UgbXVzdCBwcm92aWRlIGEgdmFsaWQgZW1haWwgc3RyaW5nJyk7XG4gICAgfVxuICAgIGNvbnN0IHVzZXJDb250cm9sbGVyID0gcmVxLmNvbmZpZy51c2VyQ29udHJvbGxlcjtcbiAgICByZXR1cm4gdXNlckNvbnRyb2xsZXIuc2VuZFBhc3N3b3JkUmVzZXRFbWFpbChlbWFpbCkudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcbiAgICAgICAgcmVzcG9uc2U6IHt9XG4gICAgICB9KTtcbiAgICB9LCBlcnIgPT4ge1xuICAgICAgaWYgKGVyci5jb2RlID09PSBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5EKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5FTUFJTF9OT1RfRk9VTkQsIGBObyB1c2VyIGZvdW5kIHdpdGggZW1haWwgJHtlbWFpbH0uYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBoYW5kbGVWZXJpZmljYXRpb25FbWFpbFJlcXVlc3QocmVxKSB7XG4gICAgdGhpcy5fdGhyb3dPbkJhZEVtYWlsQ29uZmlnKHJlcSk7XG5cbiAgICBjb25zdCB7IGVtYWlsIH0gPSByZXEuYm9keTtcbiAgICBpZiAoIWVtYWlsKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuRU1BSUxfTUlTU0lORywgJ3lvdSBtdXN0IHByb3ZpZGUgYW4gZW1haWwnKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbWFpbCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0VNQUlMX0FERFJFU1MsICd5b3UgbXVzdCBwcm92aWRlIGEgdmFsaWQgZW1haWwgc3RyaW5nJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcS5jb25maWcuZGF0YWJhc2UuZmluZCgnX1VzZXInLCB7IGVtYWlsOiBlbWFpbCB9KS50aGVuKChyZXN1bHRzKSA9PiB7XG4gICAgICBpZiAoIXJlc3VsdHMubGVuZ3RoIHx8IHJlc3VsdHMubGVuZ3RoIDwgMSkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuRU1BSUxfTk9UX0ZPVU5ELCBgTm8gdXNlciBmb3VuZCB3aXRoIGVtYWlsICR7ZW1haWx9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB1c2VyID0gcmVzdWx0c1swXTtcblxuICAgICAgLy8gcmVtb3ZlIHBhc3N3b3JkIGZpZWxkLCBtZXNzZXMgd2l0aCBzYXZpbmcgb24gcG9zdGdyZXNcbiAgICAgIGRlbGV0ZSB1c2VyLnBhc3N3b3JkO1xuXG4gICAgICBpZiAodXNlci5lbWFpbFZlcmlmaWVkKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PVEhFUl9DQVVTRSwgYEVtYWlsICR7ZW1haWx9IGlzIGFscmVhZHkgdmVyaWZpZWQuYCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHVzZXJDb250cm9sbGVyID0gcmVxLmNvbmZpZy51c2VyQ29udHJvbGxlcjtcbiAgICAgIHJldHVybiB1c2VyQ29udHJvbGxlci5yZWdlbmVyYXRlRW1haWxWZXJpZnlUb2tlbih1c2VyKS50aGVuKCgpID0+IHtcbiAgICAgICAgdXNlckNvbnRyb2xsZXIuc2VuZFZlcmlmaWNhdGlvbkVtYWlsKHVzZXIpO1xuICAgICAgICByZXR1cm4geyByZXNwb25zZToge30gfTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cblxuICBtb3VudFJvdXRlcygpIHtcbiAgICB0aGlzLnJvdXRlKCdHRVQnLCAnL3VzZXJzJywgcmVxID0+IHsgcmV0dXJuIHRoaXMuaGFuZGxlRmluZChyZXEpOyB9KTtcbiAgICB0aGlzLnJvdXRlKCdQT1NUJywgJy91c2VycycsIHJlcSA9PiB7IHJldHVybiB0aGlzLmhhbmRsZUNyZWF0ZShyZXEpOyB9KTtcbiAgICB0aGlzLnJvdXRlKCdHRVQnLCAnL3VzZXJzL21lJywgcmVxID0+IHsgcmV0dXJuIHRoaXMuaGFuZGxlTWUocmVxKTsgfSk7XG4gICAgdGhpcy5yb3V0ZSgnR0VUJywgJy91c2Vycy86b2JqZWN0SWQnLCByZXEgPT4geyByZXR1cm4gdGhpcy5oYW5kbGVHZXQocmVxKTsgfSk7XG4gICAgdGhpcy5yb3V0ZSgnUFVUJywgJy91c2Vycy86b2JqZWN0SWQnLCByZXEgPT4geyByZXR1cm4gdGhpcy5oYW5kbGVVcGRhdGUocmVxKTsgfSk7XG4gICAgdGhpcy5yb3V0ZSgnREVMRVRFJywgJy91c2Vycy86b2JqZWN0SWQnLCByZXEgPT4geyByZXR1cm4gdGhpcy5oYW5kbGVEZWxldGUocmVxKTsgfSk7XG4gICAgdGhpcy5yb3V0ZSgnR0VUJywgJy9sb2dpbicsIHJlcSA9PiB7IHJldHVybiB0aGlzLmhhbmRsZUxvZ0luKHJlcSk7IH0pO1xuICAgIHRoaXMucm91dGUoJ1BPU1QnLCAnL2xvZ2luJywgcmVxID0+IHsgcmV0dXJuIHRoaXMuaGFuZGxlTG9nSW4ocmVxKTsgfSk7XG4gICAgdGhpcy5yb3V0ZSgnUE9TVCcsICcvbG9nb3V0JywgcmVxID0+IHsgcmV0dXJuIHRoaXMuaGFuZGxlTG9nT3V0KHJlcSk7IH0pO1xuICAgIHRoaXMucm91dGUoJ1BPU1QnLCAnL3JlcXVlc3RQYXNzd29yZFJlc2V0JywgcmVxID0+IHsgcmV0dXJuIHRoaXMuaGFuZGxlUmVzZXRSZXF1ZXN0KHJlcSk7IH0pO1xuICAgIHRoaXMucm91dGUoJ1BPU1QnLCAnL3ZlcmlmaWNhdGlvbkVtYWlsUmVxdWVzdCcsIHJlcSA9PiB7IHJldHVybiB0aGlzLmhhbmRsZVZlcmlmaWNhdGlvbkVtYWlsUmVxdWVzdChyZXEpOyB9KTtcbiAgICB0aGlzLnJvdXRlKCdHRVQnLCAnL3ZlcmlmeVBhc3N3b3JkJywgcmVxID0+IHsgcmV0dXJuIHRoaXMuaGFuZGxlVmVyaWZ5UGFzc3dvcmQocmVxKTsgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVXNlcnNSb3V0ZXI7XG4iXX0=