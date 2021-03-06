'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RedisPubSub = undefined;

var _redis = require('redis');

var _redis2 = _interopRequireDefault(_redis);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createPublisher({ redisURL }) {
  return _redis2.default.createClient(redisURL, { no_ready_check: true });
}

function createSubscriber({ redisURL }) {
  return _redis2.default.createClient(redisURL, { no_ready_check: true });
}

const RedisPubSub = {
  createPublisher,
  createSubscriber
};

exports.RedisPubSub = RedisPubSub;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9BZGFwdGVycy9QdWJTdWIvUmVkaXNQdWJTdWIuanMiXSwibmFtZXMiOlsiY3JlYXRlUHVibGlzaGVyIiwicmVkaXNVUkwiLCJyZWRpcyIsImNyZWF0ZUNsaWVudCIsIm5vX3JlYWR5X2NoZWNrIiwiY3JlYXRlU3Vic2NyaWJlciIsIlJlZGlzUHViU3ViIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7Ozs7OztBQUVBLFNBQVNBLGVBQVQsQ0FBeUIsRUFBQ0MsUUFBRCxFQUF6QixFQUEwQztBQUN4QyxTQUFPQyxnQkFBTUMsWUFBTixDQUFtQkYsUUFBbkIsRUFBNkIsRUFBRUcsZ0JBQWdCLElBQWxCLEVBQTdCLENBQVA7QUFDRDs7QUFFRCxTQUFTQyxnQkFBVCxDQUEwQixFQUFDSixRQUFELEVBQTFCLEVBQTJDO0FBQ3pDLFNBQU9DLGdCQUFNQyxZQUFOLENBQW1CRixRQUFuQixFQUE2QixFQUFFRyxnQkFBZ0IsSUFBbEIsRUFBN0IsQ0FBUDtBQUNEOztBQUVELE1BQU1FLGNBQWM7QUFDbEJOLGlCQURrQjtBQUVsQks7QUFGa0IsQ0FBcEI7O1FBTUVDLFcsR0FBQUEsVyIsImZpbGUiOiJSZWRpc1B1YlN1Yi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCByZWRpcyBmcm9tICdyZWRpcyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZVB1Ymxpc2hlcih7cmVkaXNVUkx9KTogYW55IHtcbiAgcmV0dXJuIHJlZGlzLmNyZWF0ZUNsaWVudChyZWRpc1VSTCwgeyBub19yZWFkeV9jaGVjazogdHJ1ZSB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3Vic2NyaWJlcih7cmVkaXNVUkx9KTogYW55IHtcbiAgcmV0dXJuIHJlZGlzLmNyZWF0ZUNsaWVudChyZWRpc1VSTCwgeyBub19yZWFkeV9jaGVjazogdHJ1ZSB9KTtcbn1cblxuY29uc3QgUmVkaXNQdWJTdWIgPSB7XG4gIGNyZWF0ZVB1Ymxpc2hlcixcbiAgY3JlYXRlU3Vic2NyaWJlclxufVxuXG5leHBvcnQge1xuICBSZWRpc1B1YlN1YlxufVxuIl19