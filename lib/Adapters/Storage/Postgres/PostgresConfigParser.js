'use strict';

const url = require('url');

function getDatabaseOptionsFromURI(uri) {
  const databaseOptions = {};

  const parsedURI = url.parse(uri);
  const queryParams = parseQueryParams(parsedURI.query);
  const authParts = parsedURI.auth ? parsedURI.auth.split(':') : [];

  databaseOptions.host = parsedURI.hostname || 'localhost';
  databaseOptions.port = parsedURI.port ? parseInt(parsedURI.port) : 5432;
  databaseOptions.database = parsedURI.pathname ? parsedURI.pathname.substr(1) : undefined;

  databaseOptions.user = authParts.length > 0 ? authParts[0] : '';
  databaseOptions.password = authParts.length > 1 ? authParts[1] : '';

  databaseOptions.ssl = queryParams.ssl && queryParams.ssl.toLowerCase() === 'true' ? true : false;
  databaseOptions.binary = queryParams.binary && queryParams.binary.toLowerCase() === 'true' ? true : false;

  databaseOptions.client_encoding = queryParams.client_encoding;
  databaseOptions.application_name = queryParams.application_name;
  databaseOptions.fallback_application_name = queryParams.fallback_application_name;

  if (queryParams.poolSize) {
    databaseOptions.poolSize = parseInt(queryParams.poolSize) || 10;
  }

  return databaseOptions;
}

function parseQueryParams(queryString) {
  queryString = queryString || '';

  return queryString.split('&').reduce((p, c) => {
    const parts = c.split('=');
    p[decodeURIComponent(parts[0])] = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
    return p;
  }, {});
}

module.exports = {
  parseQueryParams: parseQueryParams,
  getDatabaseOptionsFromURI: getDatabaseOptionsFromURI
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9BZGFwdGVycy9TdG9yYWdlL1Bvc3RncmVzL1Bvc3RncmVzQ29uZmlnUGFyc2VyLmpzIl0sIm5hbWVzIjpbInVybCIsInJlcXVpcmUiLCJnZXREYXRhYmFzZU9wdGlvbnNGcm9tVVJJIiwidXJpIiwiZGF0YWJhc2VPcHRpb25zIiwicGFyc2VkVVJJIiwicGFyc2UiLCJxdWVyeVBhcmFtcyIsInBhcnNlUXVlcnlQYXJhbXMiLCJxdWVyeSIsImF1dGhQYXJ0cyIsImF1dGgiLCJzcGxpdCIsImhvc3QiLCJob3N0bmFtZSIsInBvcnQiLCJwYXJzZUludCIsImRhdGFiYXNlIiwicGF0aG5hbWUiLCJzdWJzdHIiLCJ1bmRlZmluZWQiLCJ1c2VyIiwibGVuZ3RoIiwicGFzc3dvcmQiLCJzc2wiLCJ0b0xvd2VyQ2FzZSIsImJpbmFyeSIsImNsaWVudF9lbmNvZGluZyIsImFwcGxpY2F0aW9uX25hbWUiLCJmYWxsYmFja19hcHBsaWNhdGlvbl9uYW1lIiwicG9vbFNpemUiLCJxdWVyeVN0cmluZyIsInJlZHVjZSIsInAiLCJjIiwicGFydHMiLCJkZWNvZGVVUklDb21wb25lbnQiLCJzbGljZSIsImpvaW4iLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOztBQUFBLE1BQU1BLE1BQU1DLFFBQVEsS0FBUixDQUFaOztBQUVBLFNBQVNDLHlCQUFULENBQW1DQyxHQUFuQyxFQUF3QztBQUN0QyxRQUFNQyxrQkFBa0IsRUFBeEI7O0FBRUEsUUFBTUMsWUFBWUwsSUFBSU0sS0FBSixDQUFVSCxHQUFWLENBQWxCO0FBQ0EsUUFBTUksY0FBY0MsaUJBQWlCSCxVQUFVSSxLQUEzQixDQUFwQjtBQUNBLFFBQU1DLFlBQVlMLFVBQVVNLElBQVYsR0FBaUJOLFVBQVVNLElBQVYsQ0FBZUMsS0FBZixDQUFxQixHQUFyQixDQUFqQixHQUE2QyxFQUEvRDs7QUFFQVIsa0JBQWdCUyxJQUFoQixHQUF1QlIsVUFBVVMsUUFBVixJQUFzQixXQUE3QztBQUNBVixrQkFBZ0JXLElBQWhCLEdBQXVCVixVQUFVVSxJQUFWLEdBQWlCQyxTQUFTWCxVQUFVVSxJQUFuQixDQUFqQixHQUE0QyxJQUFuRTtBQUNBWCxrQkFBZ0JhLFFBQWhCLEdBQTJCWixVQUFVYSxRQUFWLEdBQ3ZCYixVQUFVYSxRQUFWLENBQW1CQyxNQUFuQixDQUEwQixDQUExQixDQUR1QixHQUV2QkMsU0FGSjs7QUFJQWhCLGtCQUFnQmlCLElBQWhCLEdBQXVCWCxVQUFVWSxNQUFWLEdBQW1CLENBQW5CLEdBQXVCWixVQUFVLENBQVYsQ0FBdkIsR0FBc0MsRUFBN0Q7QUFDQU4sa0JBQWdCbUIsUUFBaEIsR0FBMkJiLFVBQVVZLE1BQVYsR0FBbUIsQ0FBbkIsR0FBdUJaLFVBQVUsQ0FBVixDQUF2QixHQUFzQyxFQUFqRTs7QUFFQU4sa0JBQWdCb0IsR0FBaEIsR0FDRWpCLFlBQVlpQixHQUFaLElBQW1CakIsWUFBWWlCLEdBQVosQ0FBZ0JDLFdBQWhCLE9BQWtDLE1BQXJELEdBQThELElBQTlELEdBQXFFLEtBRHZFO0FBRUFyQixrQkFBZ0JzQixNQUFoQixHQUNFbkIsWUFBWW1CLE1BQVosSUFBc0JuQixZQUFZbUIsTUFBWixDQUFtQkQsV0FBbkIsT0FBcUMsTUFBM0QsR0FBb0UsSUFBcEUsR0FBMkUsS0FEN0U7O0FBR0FyQixrQkFBZ0J1QixlQUFoQixHQUFrQ3BCLFlBQVlvQixlQUE5QztBQUNBdkIsa0JBQWdCd0IsZ0JBQWhCLEdBQW1DckIsWUFBWXFCLGdCQUEvQztBQUNBeEIsa0JBQWdCeUIseUJBQWhCLEdBQTRDdEIsWUFBWXNCLHlCQUF4RDs7QUFFQSxNQUFJdEIsWUFBWXVCLFFBQWhCLEVBQTBCO0FBQ3hCMUIsb0JBQWdCMEIsUUFBaEIsR0FBMkJkLFNBQVNULFlBQVl1QixRQUFyQixLQUFrQyxFQUE3RDtBQUNEOztBQUVELFNBQU8xQixlQUFQO0FBQ0Q7O0FBRUQsU0FBU0ksZ0JBQVQsQ0FBMEJ1QixXQUExQixFQUF1QztBQUNyQ0EsZ0JBQWNBLGVBQWUsRUFBN0I7O0FBRUEsU0FBT0EsWUFDSm5CLEtBREksQ0FDRSxHQURGLEVBRUpvQixNQUZJLENBRUcsQ0FBQ0MsQ0FBRCxFQUFJQyxDQUFKLEtBQVU7QUFDaEIsVUFBTUMsUUFBUUQsRUFBRXRCLEtBQUYsQ0FBUSxHQUFSLENBQWQ7QUFDQXFCLE1BQUVHLG1CQUFtQkQsTUFBTSxDQUFOLENBQW5CLENBQUYsSUFDRUEsTUFBTWIsTUFBTixHQUFlLENBQWYsR0FDSWMsbUJBQW1CRCxNQUFNRSxLQUFOLENBQVksQ0FBWixFQUFlQyxJQUFmLENBQW9CLEdBQXBCLENBQW5CLENBREosR0FFSSxFQUhOO0FBSUEsV0FBT0wsQ0FBUDtBQUNELEdBVEksRUFTRixFQVRFLENBQVA7QUFVRDs7QUFFRE0sT0FBT0MsT0FBUCxHQUFpQjtBQUNmaEMsb0JBQWtCQSxnQkFESDtBQUVmTiw2QkFBMkJBO0FBRlosQ0FBakIiLCJmaWxlIjoiUG9zdGdyZXNDb25maWdQYXJzZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB1cmwgPSByZXF1aXJlKCd1cmwnKTtcblxuZnVuY3Rpb24gZ2V0RGF0YWJhc2VPcHRpb25zRnJvbVVSSSh1cmkpIHtcbiAgY29uc3QgZGF0YWJhc2VPcHRpb25zID0ge307XG5cbiAgY29uc3QgcGFyc2VkVVJJID0gdXJsLnBhcnNlKHVyaSk7XG4gIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcGFyc2VRdWVyeVBhcmFtcyhwYXJzZWRVUkkucXVlcnkpO1xuICBjb25zdCBhdXRoUGFydHMgPSBwYXJzZWRVUkkuYXV0aCA/IHBhcnNlZFVSSS5hdXRoLnNwbGl0KCc6JykgOiBbXTtcblxuICBkYXRhYmFzZU9wdGlvbnMuaG9zdCA9IHBhcnNlZFVSSS5ob3N0bmFtZSB8fCAnbG9jYWxob3N0JztcbiAgZGF0YWJhc2VPcHRpb25zLnBvcnQgPSBwYXJzZWRVUkkucG9ydCA/IHBhcnNlSW50KHBhcnNlZFVSSS5wb3J0KSA6IDU0MzI7XG4gIGRhdGFiYXNlT3B0aW9ucy5kYXRhYmFzZSA9IHBhcnNlZFVSSS5wYXRobmFtZVxuICAgID8gcGFyc2VkVVJJLnBhdGhuYW1lLnN1YnN0cigxKVxuICAgIDogdW5kZWZpbmVkO1xuXG4gIGRhdGFiYXNlT3B0aW9ucy51c2VyID0gYXV0aFBhcnRzLmxlbmd0aCA+IDAgPyBhdXRoUGFydHNbMF0gOiAnJztcbiAgZGF0YWJhc2VPcHRpb25zLnBhc3N3b3JkID0gYXV0aFBhcnRzLmxlbmd0aCA+IDEgPyBhdXRoUGFydHNbMV0gOiAnJztcblxuICBkYXRhYmFzZU9wdGlvbnMuc3NsID1cbiAgICBxdWVyeVBhcmFtcy5zc2wgJiYgcXVlcnlQYXJhbXMuc3NsLnRvTG93ZXJDYXNlKCkgPT09ICd0cnVlJyA/IHRydWUgOiBmYWxzZTtcbiAgZGF0YWJhc2VPcHRpb25zLmJpbmFyeSA9XG4gICAgcXVlcnlQYXJhbXMuYmluYXJ5ICYmIHF1ZXJ5UGFyYW1zLmJpbmFyeS50b0xvd2VyQ2FzZSgpID09PSAndHJ1ZScgPyB0cnVlIDogZmFsc2U7XG5cbiAgZGF0YWJhc2VPcHRpb25zLmNsaWVudF9lbmNvZGluZyA9IHF1ZXJ5UGFyYW1zLmNsaWVudF9lbmNvZGluZztcbiAgZGF0YWJhc2VPcHRpb25zLmFwcGxpY2F0aW9uX25hbWUgPSBxdWVyeVBhcmFtcy5hcHBsaWNhdGlvbl9uYW1lO1xuICBkYXRhYmFzZU9wdGlvbnMuZmFsbGJhY2tfYXBwbGljYXRpb25fbmFtZSA9IHF1ZXJ5UGFyYW1zLmZhbGxiYWNrX2FwcGxpY2F0aW9uX25hbWU7XG5cbiAgaWYgKHF1ZXJ5UGFyYW1zLnBvb2xTaXplKSB7XG4gICAgZGF0YWJhc2VPcHRpb25zLnBvb2xTaXplID0gcGFyc2VJbnQocXVlcnlQYXJhbXMucG9vbFNpemUpIHx8IDEwO1xuICB9XG5cbiAgcmV0dXJuIGRhdGFiYXNlT3B0aW9ucztcbn1cblxuZnVuY3Rpb24gcGFyc2VRdWVyeVBhcmFtcyhxdWVyeVN0cmluZykge1xuICBxdWVyeVN0cmluZyA9IHF1ZXJ5U3RyaW5nIHx8ICcnO1xuXG4gIHJldHVybiBxdWVyeVN0cmluZ1xuICAgIC5zcGxpdCgnJicpXG4gICAgLnJlZHVjZSgocCwgYykgPT4ge1xuICAgICAgY29uc3QgcGFydHMgPSBjLnNwbGl0KCc9Jyk7XG4gICAgICBwW2RlY29kZVVSSUNvbXBvbmVudChwYXJ0c1swXSldID1cbiAgICAgICAgcGFydHMubGVuZ3RoID4gMVxuICAgICAgICAgID8gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnRzLnNsaWNlKDEpLmpvaW4oJz0nKSlcbiAgICAgICAgICA6ICcnO1xuICAgICAgcmV0dXJuIHA7XG4gICAgfSwge30pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgcGFyc2VRdWVyeVBhcmFtczogcGFyc2VRdWVyeVBhcmFtcyxcbiAgZ2V0RGF0YWJhc2VPcHRpb25zRnJvbVVSSTogZ2V0RGF0YWJhc2VPcHRpb25zRnJvbVVSSVxufTtcbiJdfQ==