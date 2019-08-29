"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.load = exports.extractKeysAndInclude = void 0;

var _graphql = require("graphql");

var _graphqlListFields = _interopRequireDefault(require("graphql-list-fields"));

var defaultGraphQLTypes = _interopRequireWildcard(require("./defaultGraphQLTypes"));

var objectsQueries = _interopRequireWildcard(require("./objectsQueries"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { if (i % 2) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } else { Object.defineProperties(target, Object.getOwnPropertyDescriptors(arguments[i])); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const mapInputType = (parseType, targetClass, parseClassTypes) => {
  switch (parseType) {
    case 'String':
      return _graphql.GraphQLString;

    case 'Number':
      return _graphql.GraphQLFloat;

    case 'Boolean':
      return _graphql.GraphQLBoolean;

    case 'Array':
      return new _graphql.GraphQLList(defaultGraphQLTypes.ANY);

    case 'Object':
      return defaultGraphQLTypes.OBJECT;

    case 'Date':
      return defaultGraphQLTypes.DATE;

    case 'Pointer':
      if (parseClassTypes[targetClass]) {
        return parseClassTypes[targetClass].classGraphQLScalarType;
      } else {
        return defaultGraphQLTypes.OBJECT;
      }

    case 'Relation':
      if (parseClassTypes[targetClass]) {
        return parseClassTypes[targetClass].classGraphQLRelationOpType;
      } else {
        return defaultGraphQLTypes.OBJECT;
      }

    case 'File':
      return defaultGraphQLTypes.FILE;

    case 'GeoPoint':
      return defaultGraphQLTypes.GEO_POINT;

    case 'Polygon':
      return defaultGraphQLTypes.POLYGON;

    case 'Bytes':
      return defaultGraphQLTypes.BYTES;

    case 'ACL':
      return defaultGraphQLTypes.OBJECT;

    default:
      return undefined;
  }
};

const mapOutputType = (parseType, targetClass, parseClassTypes) => {
  switch (parseType) {
    case 'String':
      return _graphql.GraphQLString;

    case 'Number':
      return _graphql.GraphQLFloat;

    case 'Boolean':
      return _graphql.GraphQLBoolean;

    case 'Array':
      return new _graphql.GraphQLList(defaultGraphQLTypes.ANY);

    case 'Object':
      return defaultGraphQLTypes.OBJECT;

    case 'Date':
      return defaultGraphQLTypes.DATE;

    case 'Pointer':
      if (parseClassTypes[targetClass]) {
        return parseClassTypes[targetClass].classGraphQLOutputType;
      } else {
        return defaultGraphQLTypes.OBJECT;
      }

    case 'Relation':
      if (parseClassTypes[targetClass]) {
        return new _graphql.GraphQLNonNull(parseClassTypes[targetClass].classGraphQLFindResultType);
      } else {
        return new _graphql.GraphQLNonNull(defaultGraphQLTypes.FIND_RESULT);
      }

    case 'File':
      return defaultGraphQLTypes.FILE_INFO;

    case 'GeoPoint':
      return defaultGraphQLTypes.GEO_POINT_INFO;

    case 'Polygon':
      return defaultGraphQLTypes.POLYGON_INFO;

    case 'Bytes':
      return defaultGraphQLTypes.BYTES;

    case 'ACL':
      return defaultGraphQLTypes.OBJECT;

    default:
      return undefined;
  }
};

const mapConstraintType = (parseType, targetClass, parseClassTypes) => {
  switch (parseType) {
    case 'String':
      return defaultGraphQLTypes.STRING_CONSTRAINT;

    case 'Number':
      return defaultGraphQLTypes.NUMBER_CONSTRAINT;

    case 'Boolean':
      return defaultGraphQLTypes.BOOLEAN_CONSTRAINT;

    case 'Array':
      return defaultGraphQLTypes.ARRAY_CONSTRAINT;

    case 'Object':
      return defaultGraphQLTypes.OBJECT_CONSTRAINT;

    case 'Date':
      return defaultGraphQLTypes.DATE_CONSTRAINT;

    case 'Pointer':
      if (parseClassTypes[targetClass]) {
        return parseClassTypes[targetClass].classGraphQLConstraintType;
      } else {
        return defaultGraphQLTypes.OBJECT;
      }

    case 'File':
      return defaultGraphQLTypes.FILE_CONSTRAINT;

    case 'GeoPoint':
      return defaultGraphQLTypes.GEO_POINT_CONSTRAINT;

    case 'Polygon':
      return defaultGraphQLTypes.POLYGON_CONSTRAINT;

    case 'Bytes':
      return defaultGraphQLTypes.BYTES_CONSTRAINT;

    case 'ACL':
      return defaultGraphQLTypes.OBJECT_CONSTRAINT;

    case 'Relation':
    default:
      return undefined;
  }
};

const extractKeysAndInclude = selectedFields => {
  selectedFields = selectedFields.filter(field => !field.includes('__typename'));
  let keys = undefined;
  let include = undefined;

  if (selectedFields && selectedFields.length > 0) {
    keys = selectedFields.join(',');
    include = selectedFields.reduce((fields, field) => {
      fields = fields.slice();
      let pointIndex = field.lastIndexOf('.');

      while (pointIndex > 0) {
        const lastField = field.slice(pointIndex + 1);
        field = field.slice(0, pointIndex);

        if (!fields.includes(field) && lastField !== 'objectId') {
          fields.push(field);
        }

        pointIndex = field.lastIndexOf('.');
      }

      return fields;
    }, []).join(',');
  }

  return {
    keys,
    include
  };
};

exports.extractKeysAndInclude = extractKeysAndInclude;

const load = (parseGraphQLSchema, parseClass) => {
  const className = parseClass.className;
  const classFields = Object.keys(parseClass.fields);
  const classCustomFields = classFields.filter(field => !Object.keys(defaultGraphQLTypes.CLASS_FIELDS).includes(field));
  const classGraphQLScalarTypeName = `${className}Pointer`;

  const parseScalarValue = value => {
    if (typeof value === 'string') {
      return {
        __type: 'Pointer',
        className,
        objectId: value
      };
    } else if (typeof value === 'object' && value.__type === 'Pointer' && value.className === className && typeof value.objectId === 'string') {
      return value;
    }

    throw new defaultGraphQLTypes.TypeValidationError(value, classGraphQLScalarTypeName);
  };

  const classGraphQLScalarType = new _graphql.GraphQLScalarType({
    name: classGraphQLScalarTypeName,
    description: `The ${classGraphQLScalarTypeName} is used in operations that involve ${className} pointers.`,
    parseValue: parseScalarValue,

    serialize(value) {
      if (typeof value === 'string') {
        return value;
      } else if (typeof value === 'object' && value.__type === 'Pointer' && value.className === className && typeof value.objectId === 'string') {
        return value.objectId;
      }

      throw new defaultGraphQLTypes.TypeValidationError(value, classGraphQLScalarTypeName);
    },

    parseLiteral(ast) {
      if (ast.kind === _graphql.Kind.STRING) {
        return parseScalarValue(ast.value);
      } else if (ast.kind === _graphql.Kind.OBJECT) {
        const __type = ast.fields.find(field => field.name.value === '__type');

        const className = ast.fields.find(field => field.name.value === 'className');
        const objectId = ast.fields.find(field => field.name.value === 'objectId');

        if (__type && __type.value && className && className.value && objectId && objectId.value) {
          return parseScalarValue({
            __type: __type.value.value,
            className: className.value.value,
            objectId: objectId.value.value
          });
        }
      }

      throw new defaultGraphQLTypes.TypeValidationError(ast.kind, classGraphQLScalarTypeName);
    }

  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLScalarType);
  const classGraphQLRelationOpTypeName = `${className}RelationOp`;
  const classGraphQLRelationOpType = new _graphql.GraphQLInputObjectType({
    name: classGraphQLRelationOpTypeName,
    description: `The ${classGraphQLRelationOpTypeName} input type is used in operations that involve relations with the ${className} class.`,
    fields: () => ({
      _op: {
        description: 'This is the operation to be executed.',
        type: new _graphql.GraphQLNonNull(defaultGraphQLTypes.RELATION_OP)
      },
      ops: {
        description: 'In the case of a Batch operation, this is the list of operations to be executed.',
        type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(classGraphQLRelationOpType))
      },
      objects: {
        description: 'In the case of a AddRelation or RemoveRelation operation, this is the list of objects to be added/removed.',
        type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(classGraphQLScalarType))
      }
    })
  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLRelationOpType);
  const classGraphQLInputTypeName = `${className}Fields`;
  const classGraphQLInputType = new _graphql.GraphQLInputObjectType({
    name: classGraphQLInputTypeName,
    description: `The ${classGraphQLInputTypeName} input type is used in operations that involve inputting objects of ${className} class.`,
    fields: () => classCustomFields.reduce((fields, field) => {
      const type = mapInputType(parseClass.fields[field].type, parseClass.fields[field].targetClass, parseGraphQLSchema.parseClassTypes);

      if (type) {
        return _objectSpread({}, fields, {
          [field]: {
            description: `This is the object ${field}.`,
            type
          }
        });
      } else {
        return fields;
      }
    }, {
      ACL: defaultGraphQLTypes.ACL_ATT
    })
  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLInputType);
  const classGraphQLConstraintTypeName = `${className}PointerConstraint`;
  const classGraphQLConstraintType = new _graphql.GraphQLInputObjectType({
    name: classGraphQLConstraintTypeName,
    description: `The ${classGraphQLConstraintTypeName} input type is used in operations that involve filtering objects by a pointer field to ${className} class.`,
    fields: {
      _eq: defaultGraphQLTypes._eq(classGraphQLScalarType),
      _ne: defaultGraphQLTypes._ne(classGraphQLScalarType),
      _in: defaultGraphQLTypes._in(classGraphQLScalarType),
      _nin: defaultGraphQLTypes._nin(classGraphQLScalarType),
      _exists: defaultGraphQLTypes._exists,
      _select: defaultGraphQLTypes._select,
      _dontSelect: defaultGraphQLTypes._dontSelect,
      _inQuery: {
        description: 'This is the $inQuery operator to specify a constraint to select the objects where a field equals to any of the ids in the result of a different query.',
        type: defaultGraphQLTypes.SUBQUERY
      },
      _notInQuery: {
        description: 'This is the $notInQuery operator to specify a constraint to select the objects where a field do not equal to any of the ids in the result of a different query.',
        type: defaultGraphQLTypes.SUBQUERY
      }
    }
  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLConstraintType);
  const classGraphQLConstraintsTypeName = `${className}Constraints`;
  const classGraphQLConstraintsType = new _graphql.GraphQLInputObjectType({
    name: classGraphQLConstraintsTypeName,
    description: `The ${classGraphQLConstraintsTypeName} input type is used in operations that involve filtering objects of ${className} class.`,
    fields: () => _objectSpread({}, classFields.reduce((fields, field) => {
      const type = mapConstraintType(parseClass.fields[field].type, parseClass.fields[field].targetClass, parseGraphQLSchema.parseClassTypes);

      if (type) {
        return _objectSpread({}, fields, {
          [field]: {
            description: `This is the object ${field}.`,
            type
          }
        });
      } else {
        return fields;
      }
    }, {}), {
      _or: {
        description: 'This is the $or operator to compound constraints.',
        type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(classGraphQLConstraintsType))
      },
      _and: {
        description: 'This is the $and operator to compound constraints.',
        type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(classGraphQLConstraintsType))
      },
      _nor: {
        description: 'This is the $nor operator to compound constraints.',
        type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(classGraphQLConstraintsType))
      }
    })
  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLConstraintsType);
  const classGraphQLOrderTypeName = `${className}Order`;
  const classGraphQLOrderType = new _graphql.GraphQLEnumType({
    name: classGraphQLOrderTypeName,
    description: `The ${classGraphQLOrderTypeName} input type is used when sorting objects of the ${className} class.`,
    values: classFields.reduce((orderFields, field) => {
      return _objectSpread({}, orderFields, {
        [`${field}_ASC`]: {
          value: field
        },
        [`${field}_DESC`]: {
          value: `-${field}`
        }
      });
    }, {})
  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLOrderType);
  const classGraphQLFindArgs = {
    where: {
      description: 'These are the conditions that the objects need to match in order to be found.',
      type: classGraphQLConstraintsType
    },
    order: {
      description: 'The fields to be used when sorting the data fetched.',
      type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(classGraphQLOrderType))
    },
    skip: defaultGraphQLTypes.SKIP_ATT,
    limit: defaultGraphQLTypes.LIMIT_ATT,
    readPreference: defaultGraphQLTypes.READ_PREFERENCE_ATT,
    includeReadPreference: defaultGraphQLTypes.INCLUDE_READ_PREFERENCE_ATT,
    subqueryReadPreference: defaultGraphQLTypes.SUBQUERY_READ_PREFERENCE_ATT
  };
  const classGraphQLOutputTypeName = `${className}Class`;

  const outputFields = () => {
    return classCustomFields.reduce((fields, field) => {
      const type = mapOutputType(parseClass.fields[field].type, parseClass.fields[field].targetClass, parseGraphQLSchema.parseClassTypes);

      if (parseClass.fields[field].type === 'Relation') {
        const targetParseClassTypes = parseGraphQLSchema.parseClassTypes[parseClass.fields[field].targetClass];
        const args = targetParseClassTypes ? targetParseClassTypes.classGraphQLFindArgs : undefined;
        return _objectSpread({}, fields, {
          [field]: {
            description: `This is the object ${field}.`,
            args,
            type,

            async resolve(source, args, context, queryInfo) {
              try {
                const {
                  where,
                  order,
                  skip,
                  limit,
                  readPreference,
                  includeReadPreference,
                  subqueryReadPreference
                } = args;
                const {
                  config,
                  auth,
                  info
                } = context;
                const selectedFields = (0, _graphqlListFields.default)(queryInfo);
                const {
                  keys,
                  include
                } = extractKeysAndInclude(selectedFields.filter(field => field.includes('.')).map(field => field.slice(field.indexOf('.') + 1)));
                return await objectsQueries.findObjects(source[field].className, _objectSpread({
                  _relatedTo: {
                    object: {
                      __type: 'Pointer',
                      className,
                      objectId: source.objectId
                    },
                    key: field
                  }
                }, where || {}), order, skip, limit, keys, include, false, readPreference, includeReadPreference, subqueryReadPreference, config, auth, info, selectedFields.map(field => field.split('.', 1)[0]));
              } catch (e) {
                parseGraphQLSchema.handleError(e);
              }
            }

          }
        });
      } else if (parseClass.fields[field].type === 'Polygon') {
        return _objectSpread({}, fields, {
          [field]: {
            description: `This is the object ${field}.`,
            type,

            async resolve(source) {
              if (source[field] && source[field].coordinates) {
                return source[field].coordinates.map(coordinate => ({
                  latitude: coordinate[0],
                  longitude: coordinate[1]
                }));
              } else {
                return null;
              }
            }

          }
        });
      } else if (type) {
        return _objectSpread({}, fields, {
          [field]: {
            description: `This is the object ${field}.`,
            type
          }
        });
      } else {
        return fields;
      }
    }, defaultGraphQLTypes.CLASS_FIELDS);
  };

  const classGraphQLOutputType = new _graphql.GraphQLObjectType({
    name: classGraphQLOutputTypeName,
    description: `The ${classGraphQLOutputTypeName} object type is used in operations that involve outputting objects of ${className} class.`,
    interfaces: [defaultGraphQLTypes.CLASS],
    fields: outputFields
  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLOutputType);
  const classGraphQLFindResultTypeName = `${className}FindResult`;
  const classGraphQLFindResultType = new _graphql.GraphQLObjectType({
    name: classGraphQLFindResultTypeName,
    description: `The ${classGraphQLFindResultTypeName} object type is used in the ${className} find query to return the data of the matched objects.`,
    fields: {
      results: {
        description: 'This is the objects returned by the query',
        type: new _graphql.GraphQLNonNull(new _graphql.GraphQLList(new _graphql.GraphQLNonNull(classGraphQLOutputType)))
      },
      count: defaultGraphQLTypes.COUNT_ATT
    }
  });
  parseGraphQLSchema.graphQLTypes.push(classGraphQLFindResultType);
  parseGraphQLSchema.parseClassTypes[className] = {
    classGraphQLScalarType,
    classGraphQLRelationOpType,
    classGraphQLInputType,
    classGraphQLConstraintType,
    classGraphQLConstraintsType,
    classGraphQLFindArgs,
    classGraphQLOutputType,
    classGraphQLFindResultType
  };

  if (className === '_User') {
    const meType = new _graphql.GraphQLObjectType({
      name: 'Me',
      description: `The Me object type is used in operations that involve outputting the current user data.`,
      interfaces: [defaultGraphQLTypes.CLASS],
      fields: () => _objectSpread({}, outputFields(), {
        sessionToken: defaultGraphQLTypes.SESSION_TOKEN_ATT
      })
    });
    parseGraphQLSchema.meType = meType;
    parseGraphQLSchema.graphQLTypes.push(meType);
    const userSignUpInputTypeName = `_UserSignUpFields`;
    const userSignUpInputType = new _graphql.GraphQLInputObjectType({
      name: userSignUpInputTypeName,
      description: `The ${userSignUpInputTypeName} input type is used in operations that involve inputting objects of ${className} class when signing up.`,
      fields: () => classCustomFields.reduce((fields, field) => {
        const type = mapInputType(parseClass.fields[field].type, parseClass.fields[field].targetClass, parseGraphQLSchema.parseClassTypes);

        if (type) {
          return _objectSpread({}, fields, {
            [field]: {
              description: `This is the object ${field}.`,
              type: field === 'username' || field === 'password' ? new _graphql.GraphQLNonNull(type) : type
            }
          });
        } else {
          return fields;
        }
      }, {
        ACL: defaultGraphQLTypes.ACL_ATT
      })
    });
    parseGraphQLSchema.parseClassTypes['_User'].signUpInputType = userSignUpInputType;
    parseGraphQLSchema.graphQLTypes.push(userSignUpInputType);
  }
};

exports.load = load;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9HcmFwaFFML2xvYWRlcnMvcGFyc2VDbGFzc1R5cGVzLmpzIl0sIm5hbWVzIjpbIm1hcElucHV0VHlwZSIsInBhcnNlVHlwZSIsInRhcmdldENsYXNzIiwicGFyc2VDbGFzc1R5cGVzIiwiR3JhcGhRTFN0cmluZyIsIkdyYXBoUUxGbG9hdCIsIkdyYXBoUUxCb29sZWFuIiwiR3JhcGhRTExpc3QiLCJkZWZhdWx0R3JhcGhRTFR5cGVzIiwiQU5ZIiwiT0JKRUNUIiwiREFURSIsImNsYXNzR3JhcGhRTFNjYWxhclR5cGUiLCJjbGFzc0dyYXBoUUxSZWxhdGlvbk9wVHlwZSIsIkZJTEUiLCJHRU9fUE9JTlQiLCJQT0xZR09OIiwiQllURVMiLCJ1bmRlZmluZWQiLCJtYXBPdXRwdXRUeXBlIiwiY2xhc3NHcmFwaFFMT3V0cHV0VHlwZSIsIkdyYXBoUUxOb25OdWxsIiwiY2xhc3NHcmFwaFFMRmluZFJlc3VsdFR5cGUiLCJGSU5EX1JFU1VMVCIsIkZJTEVfSU5GTyIsIkdFT19QT0lOVF9JTkZPIiwiUE9MWUdPTl9JTkZPIiwibWFwQ29uc3RyYWludFR5cGUiLCJTVFJJTkdfQ09OU1RSQUlOVCIsIk5VTUJFUl9DT05TVFJBSU5UIiwiQk9PTEVBTl9DT05TVFJBSU5UIiwiQVJSQVlfQ09OU1RSQUlOVCIsIk9CSkVDVF9DT05TVFJBSU5UIiwiREFURV9DT05TVFJBSU5UIiwiY2xhc3NHcmFwaFFMQ29uc3RyYWludFR5cGUiLCJGSUxFX0NPTlNUUkFJTlQiLCJHRU9fUE9JTlRfQ09OU1RSQUlOVCIsIlBPTFlHT05fQ09OU1RSQUlOVCIsIkJZVEVTX0NPTlNUUkFJTlQiLCJleHRyYWN0S2V5c0FuZEluY2x1ZGUiLCJzZWxlY3RlZEZpZWxkcyIsImZpbHRlciIsImZpZWxkIiwiaW5jbHVkZXMiLCJrZXlzIiwiaW5jbHVkZSIsImxlbmd0aCIsImpvaW4iLCJyZWR1Y2UiLCJmaWVsZHMiLCJzbGljZSIsInBvaW50SW5kZXgiLCJsYXN0SW5kZXhPZiIsImxhc3RGaWVsZCIsInB1c2giLCJsb2FkIiwicGFyc2VHcmFwaFFMU2NoZW1hIiwicGFyc2VDbGFzcyIsImNsYXNzTmFtZSIsImNsYXNzRmllbGRzIiwiT2JqZWN0IiwiY2xhc3NDdXN0b21GaWVsZHMiLCJDTEFTU19GSUVMRFMiLCJjbGFzc0dyYXBoUUxTY2FsYXJUeXBlTmFtZSIsInBhcnNlU2NhbGFyVmFsdWUiLCJ2YWx1ZSIsIl9fdHlwZSIsIm9iamVjdElkIiwiVHlwZVZhbGlkYXRpb25FcnJvciIsIkdyYXBoUUxTY2FsYXJUeXBlIiwibmFtZSIsImRlc2NyaXB0aW9uIiwicGFyc2VWYWx1ZSIsInNlcmlhbGl6ZSIsInBhcnNlTGl0ZXJhbCIsImFzdCIsImtpbmQiLCJLaW5kIiwiU1RSSU5HIiwiZmluZCIsImdyYXBoUUxUeXBlcyIsImNsYXNzR3JhcGhRTFJlbGF0aW9uT3BUeXBlTmFtZSIsIkdyYXBoUUxJbnB1dE9iamVjdFR5cGUiLCJfb3AiLCJ0eXBlIiwiUkVMQVRJT05fT1AiLCJvcHMiLCJvYmplY3RzIiwiY2xhc3NHcmFwaFFMSW5wdXRUeXBlTmFtZSIsImNsYXNzR3JhcGhRTElucHV0VHlwZSIsIkFDTCIsIkFDTF9BVFQiLCJjbGFzc0dyYXBoUUxDb25zdHJhaW50VHlwZU5hbWUiLCJfZXEiLCJfbmUiLCJfaW4iLCJfbmluIiwiX2V4aXN0cyIsIl9zZWxlY3QiLCJfZG9udFNlbGVjdCIsIl9pblF1ZXJ5IiwiU1VCUVVFUlkiLCJfbm90SW5RdWVyeSIsImNsYXNzR3JhcGhRTENvbnN0cmFpbnRzVHlwZU5hbWUiLCJjbGFzc0dyYXBoUUxDb25zdHJhaW50c1R5cGUiLCJfb3IiLCJfYW5kIiwiX25vciIsImNsYXNzR3JhcGhRTE9yZGVyVHlwZU5hbWUiLCJjbGFzc0dyYXBoUUxPcmRlclR5cGUiLCJHcmFwaFFMRW51bVR5cGUiLCJ2YWx1ZXMiLCJvcmRlckZpZWxkcyIsImNsYXNzR3JhcGhRTEZpbmRBcmdzIiwid2hlcmUiLCJvcmRlciIsInNraXAiLCJTS0lQX0FUVCIsImxpbWl0IiwiTElNSVRfQVRUIiwicmVhZFByZWZlcmVuY2UiLCJSRUFEX1BSRUZFUkVOQ0VfQVRUIiwiaW5jbHVkZVJlYWRQcmVmZXJlbmNlIiwiSU5DTFVERV9SRUFEX1BSRUZFUkVOQ0VfQVRUIiwic3VicXVlcnlSZWFkUHJlZmVyZW5jZSIsIlNVQlFVRVJZX1JFQURfUFJFRkVSRU5DRV9BVFQiLCJjbGFzc0dyYXBoUUxPdXRwdXRUeXBlTmFtZSIsIm91dHB1dEZpZWxkcyIsInRhcmdldFBhcnNlQ2xhc3NUeXBlcyIsImFyZ3MiLCJyZXNvbHZlIiwic291cmNlIiwiY29udGV4dCIsInF1ZXJ5SW5mbyIsImNvbmZpZyIsImF1dGgiLCJpbmZvIiwibWFwIiwiaW5kZXhPZiIsIm9iamVjdHNRdWVyaWVzIiwiZmluZE9iamVjdHMiLCJfcmVsYXRlZFRvIiwib2JqZWN0Iiwia2V5Iiwic3BsaXQiLCJlIiwiaGFuZGxlRXJyb3IiLCJjb29yZGluYXRlcyIsImNvb3JkaW5hdGUiLCJsYXRpdHVkZSIsImxvbmdpdHVkZSIsIkdyYXBoUUxPYmplY3RUeXBlIiwiaW50ZXJmYWNlcyIsIkNMQVNTIiwiY2xhc3NHcmFwaFFMRmluZFJlc3VsdFR5cGVOYW1lIiwicmVzdWx0cyIsImNvdW50IiwiQ09VTlRfQVRUIiwibWVUeXBlIiwic2Vzc2lvblRva2VuIiwiU0VTU0lPTl9UT0tFTl9BVFQiLCJ1c2VyU2lnblVwSW5wdXRUeXBlTmFtZSIsInVzZXJTaWduVXBJbnB1dFR5cGUiLCJzaWduVXBJbnB1dFR5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFZQTs7QUFDQTs7QUFDQTs7Ozs7Ozs7OztBQUVBLE1BQU1BLFlBQVksR0FBRyxDQUFDQyxTQUFELEVBQVlDLFdBQVosRUFBeUJDLGVBQXpCLEtBQTZDO0FBQ2hFLFVBQVFGLFNBQVI7QUFDRSxTQUFLLFFBQUw7QUFDRSxhQUFPRyxzQkFBUDs7QUFDRixTQUFLLFFBQUw7QUFDRSxhQUFPQyxxQkFBUDs7QUFDRixTQUFLLFNBQUw7QUFDRSxhQUFPQyx1QkFBUDs7QUFDRixT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V0FBVyxFQUFHLE9BQU0wRix1QkFBd0IsdUVBQXNFdkcsU0FBVSx5QkFGdkU7QUFHckRULE1BQUFBLE1BQU0sRUFBRSxNQUNOWSxpQkFBaUIsQ0FBQ2IsTUFBbEIsQ0FDRSxDQUFDQyxNQUFELEVBQVNQLEtBQVQsS0FBbUI7QUFDakIsY0FBTTBDLElBQUksR0FBR3BGLFlBQVksQ0FDdkJ5RCxVQUFVLENBQUNSLE1BQVgsQ0FBa0JQLEtBQWxCLEVBQXlCMEMsSUFERixFQUV2QjNCLFVBQVUsQ0FBQ1IsTUFBWCxDQUFrQlAsS0FBbEIsRUFBeUJ4QyxXQUZGLEVBR3ZCc0Qsa0JBQWtCLENBQUNyRCxlQUhJLENBQXpCOztBQUtBLFlBQUlpRixJQUFKLEVBQVU7QUFDUixtQ0FDS25DLE1BREw7QUFFRSxhQUFDUCxLQUFELEdBQVM7QUFDUDZCLGNBQUFBLFdBQVcsRUFBRyxzQkFBcUI3QixLQUFNLEdBRGxDO0FBRVAwQyxjQUFBQSxJQUFJLEVBQ0YxQyxLQUFLLEtBQUssVUFBVixJQUF3QkEsS0FBSyxLQUFLLFVBQWxDLEdBQ0ksSUFBSXJCLHVCQUFKLENBQW1CK0QsSUFBbkIsQ0FESixHQUVJQTtBQUxDO0FBRlg7QUFVRCxTQVhELE1BV087QUFDTCxpQkFBT25DLE1BQVA7QUFDRDtBQUNGLE9BckJILEVBc0JFO0FBQ0V5QyxRQUFBQSxHQUFHLEVBQUVsRixtQkFBbUIsQ0FBQ21GO0FBRDNCLE9BdEJGO0FBSm1ELEtBQTNCLENBQTVCO0FBK0JBbkMsSUFBQUEsa0JBQWtCLENBQUNyRCxlQUFuQixDQUNFLE9BREYsRUFFRWdLLGVBRkYsR0FFb0JELG1CQUZwQjtBQUdBMUcsSUFBQUEsa0JBQWtCLENBQUN3QixZQUFuQixDQUFnQzFCLElBQWhDLENBQXFDNEcsbUJBQXJDO0FBQ0Q7QUFDRixDQTVhRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEtpbmQsXG4gIEdyYXBoUUxPYmplY3RUeXBlLFxuICBHcmFwaFFMU3RyaW5nLFxuICBHcmFwaFFMRmxvYXQsXG4gIEdyYXBoUUxCb29sZWFuLFxuICBHcmFwaFFMTGlzdCxcbiAgR3JhcGhRTElucHV0T2JqZWN0VHlwZSxcbiAgR3JhcGhRTE5vbk51bGwsXG4gIEdyYXBoUUxTY2FsYXJUeXBlLFxuICBHcmFwaFFMRW51bVR5cGUsXG59IGZyb20gJ2dyYXBocWwnO1xuaW1wb3J0IGdldEZpZWxkTmFtZXMgZnJvbSAnZ3JhcGhxbC1saXN0LWZpZWxkcyc7XG5pbXBvcnQgKiBhcyBkZWZhdWx0R3JhcGhRTFR5cGVzIGZyb20gJy4vZGVmYXVsdEdyYXBoUUxUeXBlcyc7XG5pbXBvcnQgKiBhcyBvYmplY3RzUXVlcmllcyBmcm9tICcuL29iamVjdHNRdWVyaWVzJztcblxuY29uc3QgbWFwSW5wdXRUeXBlID0gKHBhcnNlVHlwZSwgdGFyZ2V0Q2xhc3MsIHBhcnNlQ2xhc3NUeXBlcykgPT4ge1xuICBzd2l0Y2ggKHBhcnNlVHlwZSkge1xuICAgIGNhc2UgJ1N0cmluZyc6XG4gICAgICByZXR1cm4gR3JhcGhRTFN0cmluZztcbiAgICBjYXNlICdOdW1iZXInOlxuICAgICAgcmV0dXJuIEdyYXBoUUxGbG9hdDtcbiAgICBjYXNlICdCb29sZWFuJzpcbiAgICAgIHJldHVybiBHcmFwaFFMQm9vbGVhbjtcbiAgICBjYXNlICdBcnJheSc6XG4gICAgICByZXR1cm4gbmV3IEdyYXBoUUxMaXN0KGRlZmF1bHRHcmFwaFFMVHlwZXMuQU5ZKTtcbiAgICBjYXNlICdPYmplY3QnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuT0JKRUNUO1xuICAgIGNhc2UgJ0RhdGUnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuREFURTtcbiAgICBjYXNlICdQb2ludGVyJzpcbiAgICAgIGlmIChwYXJzZUNsYXNzVHlwZXNbdGFyZ2V0Q2xhc3NdKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUNsYXNzVHlwZXNbdGFyZ2V0Q2xhc3NdLmNsYXNzR3JhcGhRTFNjYWxhclR5cGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5PQkpFQ1Q7XG4gICAgICB9XG4gICAgY2FzZSAnUmVsYXRpb24nOlxuICAgICAgaWYgKHBhcnNlQ2xhc3NUeXBlc1t0YXJnZXRDbGFzc10pIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlQ2xhc3NUeXBlc1t0YXJnZXRDbGFzc10uY2xhc3NHcmFwaFFMUmVsYXRpb25PcFR5cGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5PQkpFQ1Q7XG4gICAgICB9XG4gICAgY2FzZSAnRmlsZSc6XG4gICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5GSUxFO1xuICAgIGNhc2UgJ0dlb1BvaW50JzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLkdFT19QT0lOVDtcbiAgICBjYXNlICdQb2x5Z29uJzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLlBPTFlHT047XG4gICAgY2FzZSAnQnl0ZXMnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuQllURVM7XG4gICAgY2FzZSAnQUNMJzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLk9CSkVDVDtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufTtcblxuY29uc3QgbWFwT3V0cHV0VHlwZSA9IChwYXJzZVR5cGUsIHRhcmdldENsYXNzLCBwYXJzZUNsYXNzVHlwZXMpID0+IHtcbiAgc3dpdGNoIChwYXJzZVR5cGUpIHtcbiAgICBjYXNlICdTdHJpbmcnOlxuICAgICAgcmV0dXJuIEdyYXBoUUxTdHJpbmc7XG4gICAgY2FzZSAnTnVtYmVyJzpcbiAgICAgIHJldHVybiBHcmFwaFFMRmxvYXQ7XG4gICAgY2FzZSAnQm9vbGVhbic6XG4gICAgICByZXR1cm4gR3JhcGhRTEJvb2xlYW47XG4gICAgY2FzZSAnQXJyYXknOlxuICAgICAgcmV0dXJuIG5ldyBHcmFwaFFMTGlzdChkZWZhdWx0R3JhcGhRTFR5cGVzLkFOWSk7XG4gICAgY2FzZSAnT2JqZWN0JzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLk9CSkVDVDtcbiAgICBjYXNlICdEYXRlJzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLkRBVEU7XG4gICAgY2FzZSAnUG9pbnRlcic6XG4gICAgICBpZiAocGFyc2VDbGFzc1R5cGVzW3RhcmdldENsYXNzXSkge1xuICAgICAgICByZXR1cm4gcGFyc2VDbGFzc1R5cGVzW3RhcmdldENsYXNzXS5jbGFzc0dyYXBoUUxPdXRwdXRUeXBlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuT0JKRUNUO1xuICAgICAgfVxuICAgIGNhc2UgJ1JlbGF0aW9uJzpcbiAgICAgIGlmIChwYXJzZUNsYXNzVHlwZXNbdGFyZ2V0Q2xhc3NdKSB7XG4gICAgICAgIHJldHVybiBuZXcgR3JhcGhRTE5vbk51bGwoXG4gICAgICAgICAgcGFyc2VDbGFzc1R5cGVzW3RhcmdldENsYXNzXS5jbGFzc0dyYXBoUUxGaW5kUmVzdWx0VHlwZVxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5ldyBHcmFwaFFMTm9uTnVsbChkZWZhdWx0R3JhcGhRTFR5cGVzLkZJTkRfUkVTVUxUKTtcbiAgICAgIH1cbiAgICBjYXNlICdGaWxlJzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLkZJTEVfSU5GTztcbiAgICBjYXNlICdHZW9Qb2ludCc6XG4gICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5HRU9fUE9JTlRfSU5GTztcbiAgICBjYXNlICdQb2x5Z29uJzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLlBPTFlHT05fSU5GTztcbiAgICBjYXNlICdCeXRlcyc6XG4gICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5CWVRFUztcbiAgICBjYXNlICdBQ0wnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuT0JKRUNUO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59O1xuXG5jb25zdCBtYXBDb25zdHJhaW50VHlwZSA9IChwYXJzZVR5cGUsIHRhcmdldENsYXNzLCBwYXJzZUNsYXNzVHlwZXMpID0+IHtcbiAgc3dpdGNoIChwYXJzZVR5cGUpIHtcbiAgICBjYXNlICdTdHJpbmcnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuU1RSSU5HX0NPTlNUUkFJTlQ7XG4gICAgY2FzZSAnTnVtYmVyJzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLk5VTUJFUl9DT05TVFJBSU5UO1xuICAgIGNhc2UgJ0Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuQk9PTEVBTl9DT05TVFJBSU5UO1xuICAgIGNhc2UgJ0FycmF5JzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLkFSUkFZX0NPTlNUUkFJTlQ7XG4gICAgY2FzZSAnT2JqZWN0JzpcbiAgICAgIHJldHVybiBkZWZhdWx0R3JhcGhRTFR5cGVzLk9CSkVDVF9DT05TVFJBSU5UO1xuICAgIGNhc2UgJ0RhdGUnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuREFURV9DT05TVFJBSU5UO1xuICAgIGNhc2UgJ1BvaW50ZXInOlxuICAgICAgaWYgKHBhcnNlQ2xhc3NUeXBlc1t0YXJnZXRDbGFzc10pIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlQ2xhc3NUeXBlc1t0YXJnZXRDbGFzc10uY2xhc3NHcmFwaFFMQ29uc3RyYWludFR5cGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5PQkpFQ1Q7XG4gICAgICB9XG4gICAgY2FzZSAnRmlsZSc6XG4gICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5GSUxFX0NPTlNUUkFJTlQ7XG4gICAgY2FzZSAnR2VvUG9pbnQnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuR0VPX1BPSU5UX0NPTlNUUkFJTlQ7XG4gICAgY2FzZSAnUG9seWdvbic6XG4gICAgICByZXR1cm4gZGVmYXVsdEdyYXBoUUxUeXBlcy5QT0xZR09OX0NPTlNUUkFJTlQ7XG4gICAgY2FzZSAnQnl0ZXMnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuQllURVNfQ09OU1RSQUlOVDtcbiAgICBjYXNlICdBQ0wnOlxuICAgICAgcmV0dXJuIGRlZmF1bHRHcmFwaFFMVHlwZXMuT0JKRUNUX0NPTlNUUkFJTlQ7XG4gICAgY2FzZSAnUmVsYXRpb24nOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59O1xuXG5jb25zdCBleHRyYWN0S2V5c0FuZEluY2x1ZGUgPSBzZWxlY3RlZEZpZWxkcyA9PiB7XG4gIHNlbGVjdGVkRmllbGRzID0gc2VsZWN0ZWRGaWVsZHMuZmlsdGVyKFxuICAgIGZpZWxkID0+ICFmaWVsZC5pbmNsdWRlcygnX190eXBlbmFtZScpXG4gICk7XG4gIGxldCBrZXlzID0gdW5kZWZpbmVkO1xuICBsZXQgaW5jbHVkZSA9IHVuZGVmaW5lZDtcbiAgaWYgKHNlbGVjdGVkRmllbGRzICYmIHNlbGVjdGVkRmllbGRzLmxlbmd0aCA+IDApIHtcbiAgICBrZXlzID0gc2VsZWN0ZWRGaWVsZHMuam9pbignLCcpO1xuICAgIGluY2x1ZGUgPSBzZWxlY3RlZEZpZWxkc1xuICAgICAgLnJlZHVjZSgoZmllbGRzLCBmaWVsZCkgPT4ge1xuICAgICAgICBmaWVsZHMgPSBmaWVsZHMuc2xpY2UoKTtcbiAgICAgICAgbGV0IHBvaW50SW5kZXggPSBmaWVsZC5sYXN0SW5kZXhPZignLicpO1xuICAgICAgICB3aGlsZSAocG9pbnRJbmRleCA+IDApIHtcbiAgICAgICAgICBjb25zdCBsYXN0RmllbGQgPSBmaWVsZC5zbGljZShwb2ludEluZGV4ICsgMSk7XG4gICAgICAgICAgZmllbGQgPSBmaWVsZC5zbGljZSgwLCBwb2ludEluZGV4KTtcbiAgICAgICAgICBpZiAoIWZpZWxkcy5pbmNsdWRlcyhmaWVsZCkgJiYgbGFzdEZpZWxkICE9PSAnb2JqZWN0SWQnKSB7XG4gICAgICAgICAgICBmaWVsZHMucHVzaChmaWVsZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBvaW50SW5kZXggPSBmaWVsZC5sYXN0SW5kZXhPZignLicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWVsZHM7XG4gICAgICB9LCBbXSlcbiAgICAgIC5qb2luKCcsJyk7XG4gIH1cbiAgcmV0dXJuIHsga2V5cywgaW5jbHVkZSB9O1xufTtcblxuY29uc3QgbG9hZCA9IChwYXJzZUdyYXBoUUxTY2hlbWEsIHBhcnNlQ2xhc3MpID0+IHtcbiAgY29uc3QgY2xhc3NOYW1lID0gcGFyc2VDbGFzcy5jbGFzc05hbWU7XG5cbiAgY29uc3QgY2xhc3NGaWVsZHMgPSBPYmplY3Qua2V5cyhwYXJzZUNsYXNzLmZpZWxkcyk7XG5cbiAgY29uc3QgY2xhc3NDdXN0b21GaWVsZHMgPSBjbGFzc0ZpZWxkcy5maWx0ZXIoXG4gICAgZmllbGQgPT4gIU9iamVjdC5rZXlzKGRlZmF1bHRHcmFwaFFMVHlwZXMuQ0xBU1NfRklFTERTKS5pbmNsdWRlcyhmaWVsZClcbiAgKTtcblxuICBjb25zdCBjbGFzc0dyYXBoUUxTY2FsYXJUeXBlTmFtZSA9IGAke2NsYXNzTmFtZX1Qb2ludGVyYDtcbiAgY29uc3QgcGFyc2VTY2FsYXJWYWx1ZSA9IHZhbHVlID0+IHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgX190eXBlOiAnUG9pbnRlcicsXG4gICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgb2JqZWN0SWQ6IHZhbHVlLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgICAgdmFsdWUuX190eXBlID09PSAnUG9pbnRlcicgJiZcbiAgICAgIHZhbHVlLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lICYmXG4gICAgICB0eXBlb2YgdmFsdWUub2JqZWN0SWQgPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IGRlZmF1bHRHcmFwaFFMVHlwZXMuVHlwZVZhbGlkYXRpb25FcnJvcihcbiAgICAgIHZhbHVlLFxuICAgICAgY2xhc3NHcmFwaFFMU2NhbGFyVHlwZU5hbWVcbiAgICApO1xuICB9O1xuICBjb25zdCBjbGFzc0dyYXBoUUxTY2FsYXJUeXBlID0gbmV3IEdyYXBoUUxTY2FsYXJUeXBlKHtcbiAgICBuYW1lOiBjbGFzc0dyYXBoUUxTY2FsYXJUeXBlTmFtZSxcbiAgICBkZXNjcmlwdGlvbjogYFRoZSAke2NsYXNzR3JhcGhRTFNjYWxhclR5cGVOYW1lfSBpcyB1c2VkIGluIG9wZXJhdGlvbnMgdGhhdCBpbnZvbHZlICR7Y2xhc3NOYW1lfSBwb2ludGVycy5gLFxuICAgIHBhcnNlVmFsdWU6IHBhcnNlU2NhbGFyVmFsdWUsXG4gICAgc2VyaWFsaXplKHZhbHVlKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgICAgIHZhbHVlLl9fdHlwZSA9PT0gJ1BvaW50ZXInICYmXG4gICAgICAgIHZhbHVlLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lICYmXG4gICAgICAgIHR5cGVvZiB2YWx1ZS5vYmplY3RJZCA9PT0gJ3N0cmluZydcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gdmFsdWUub2JqZWN0SWQ7XG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBkZWZhdWx0R3JhcGhRTFR5cGVzLlR5cGVWYWxpZGF0aW9uRXJyb3IoXG4gICAgICAgIHZhbHVlLFxuICAgICAgICBjbGFzc0dyYXBoUUxTY2FsYXJUeXBlTmFtZVxuICAgICAgKTtcbiAgICB9LFxuICAgIHBhcnNlTGl0ZXJhbChhc3QpIHtcbiAgICAgIGlmIChhc3Qua2luZCA9PT0gS2luZC5TVFJJTkcpIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlU2NhbGFyVmFsdWUoYXN0LnZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoYXN0LmtpbmQgPT09IEtpbmQuT0JKRUNUKSB7XG4gICAgICAgIGNvbnN0IF9fdHlwZSA9IGFzdC5maWVsZHMuZmluZChmaWVsZCA9PiBmaWVsZC5uYW1lLnZhbHVlID09PSAnX190eXBlJyk7XG4gICAgICAgIGNvbnN0IGNsYXNzTmFtZSA9IGFzdC5maWVsZHMuZmluZChcbiAgICAgICAgICBmaWVsZCA9PiBmaWVsZC5uYW1lLnZhbHVlID09PSAnY2xhc3NOYW1lJ1xuICAgICAgICApO1xuICAgICAgICBjb25zdCBvYmplY3RJZCA9IGFzdC5maWVsZHMuZmluZChcbiAgICAgICAgICBmaWVsZCA9PiBmaWVsZC5uYW1lLnZhbHVlID09PSAnb2JqZWN0SWQnXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBfX3R5cGUgJiZcbiAgICAgICAgICBfX3R5cGUudmFsdWUgJiZcbiAgICAgICAgICBjbGFzc05hbWUgJiZcbiAgICAgICAgICBjbGFzc05hbWUudmFsdWUgJiZcbiAgICAgICAgICBvYmplY3RJZCAmJlxuICAgICAgICAgIG9iamVjdElkLnZhbHVlXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiBwYXJzZVNjYWxhclZhbHVlKHtcbiAgICAgICAgICAgIF9fdHlwZTogX190eXBlLnZhbHVlLnZhbHVlLFxuICAgICAgICAgICAgY2xhc3NOYW1lOiBjbGFzc05hbWUudmFsdWUudmFsdWUsXG4gICAgICAgICAgICBvYmplY3RJZDogb2JqZWN0SWQudmFsdWUudmFsdWUsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhyb3cgbmV3IGRlZmF1bHRHcmFwaFFMVHlwZXMuVHlwZVZhbGlkYXRpb25FcnJvcihcbiAgICAgICAgYXN0LmtpbmQsXG4gICAgICAgIGNsYXNzR3JhcGhRTFNjYWxhclR5cGVOYW1lXG4gICAgICApO1xuICAgIH0sXG4gIH0pO1xuICBwYXJzZUdyYXBoUUxTY2hlbWEuZ3JhcGhRTFR5cGVzLnB1c2goY2xhc3NHcmFwaFFMU2NhbGFyVHlwZSk7XG5cbiAgY29uc3QgY2xhc3NHcmFwaFFMUmVsYXRpb25PcFR5cGVOYW1lID0gYCR7Y2xhc3NOYW1lfVJlbGF0aW9uT3BgO1xuICBjb25zdCBjbGFzc0dyYXBoUUxSZWxhdGlvbk9wVHlwZSA9IG5ldyBHcmFwaFFMSW5wdXRPYmplY3RUeXBlKHtcbiAgICBuYW1lOiBjbGFzc0dyYXBoUUxSZWxhdGlvbk9wVHlwZU5hbWUsXG4gICAgZGVzY3JpcHRpb246IGBUaGUgJHtjbGFzc0dyYXBoUUxSZWxhdGlvbk9wVHlwZU5hbWV9IGlucHV0IHR5cGUgaXMgdXNlZCBpbiBvcGVyYXRpb25zIHRoYXQgaW52b2x2ZSByZWxhdGlvbnMgd2l0aCB0aGUgJHtjbGFzc05hbWV9IGNsYXNzLmAsXG4gICAgZmllbGRzOiAoKSA9PiAoe1xuICAgICAgX29wOiB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnVGhpcyBpcyB0aGUgb3BlcmF0aW9uIHRvIGJlIGV4ZWN1dGVkLicsXG4gICAgICAgIHR5cGU6IG5ldyBHcmFwaFFMTm9uTnVsbChkZWZhdWx0R3JhcGhRTFR5cGVzLlJFTEFUSU9OX09QKSxcbiAgICAgIH0sXG4gICAgICBvcHM6IHtcbiAgICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICAgJ0luIHRoZSBjYXNlIG9mIGEgQmF0Y2ggb3BlcmF0aW9uLCB0aGlzIGlzIHRoZSBsaXN0IG9mIG9wZXJhdGlvbnMgdG8gYmUgZXhlY3V0ZWQuJyxcbiAgICAgICAgdHlwZTogbmV3IEdyYXBoUUxMaXN0KG5ldyBHcmFwaFFMTm9uTnVsbChjbGFzc0dyYXBoUUxSZWxhdGlvbk9wVHlwZSkpLFxuICAgICAgfSxcbiAgICAgIG9iamVjdHM6IHtcbiAgICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICAgJ0luIHRoZSBjYXNlIG9mIGEgQWRkUmVsYXRpb24gb3IgUmVtb3ZlUmVsYXRpb24gb3BlcmF0aW9uLCB0aGlzIGlzIHRoZSBsaXN0IG9mIG9iamVjdHMgdG8gYmUgYWRkZWQvcmVtb3ZlZC4nLFxuICAgICAgICB0eXBlOiBuZXcgR3JhcGhRTExpc3QobmV3IEdyYXBoUUxOb25OdWxsKGNsYXNzR3JhcGhRTFNjYWxhclR5cGUpKSxcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pO1xuICBwYXJzZUdyYXBoUUxTY2hlbWEuZ3JhcGhRTFR5cGVzLnB1c2goY2xhc3NHcmFwaFFMUmVsYXRpb25PcFR5cGUpO1xuXG4gIGNvbnN0IGNsYXNzR3JhcGhRTElucHV0VHlwZU5hbWUgPSBgJHtjbGFzc05hbWV9RmllbGRzYDtcbiAgY29uc3QgY2xhc3NHcmFwaFFMSW5wdXRUeXBlID0gbmV3IEdyYXBoUUxJbnB1dE9iamVjdFR5cGUoe1xuICAgIG5hbWU6IGNsYXNzR3JhcGhRTElucHV0VHlwZU5hbWUsXG4gICAgZGVzY3JpcHRpb246IGBUaGUgJHtjbGFzc0dyYXBoUUxJbnB1dFR5cGVOYW1lfSBpbnB1dCB0eXBlIGlzIHVzZWQgaW4gb3BlcmF0aW9ucyB0aGF0IGludm9sdmUgaW5wdXR0aW5nIG9iamVjdHMgb2YgJHtjbGFzc05hbWV9IGNsYXNzLmAsXG4gICAgZmllbGRzOiAoKSA9PlxuICAgICAgY2xhc3NDdXN0b21GaWVsZHMucmVkdWNlKFxuICAgICAgICAoZmllbGRzLCBmaWVsZCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHR5cGUgPSBtYXBJbnB1dFR5cGUoXG4gICAgICAgICAgICBwYXJzZUNsYXNzLmZpZWxkc1tmaWVsZF0udHlwZSxcbiAgICAgICAgICAgIHBhcnNlQ2xhc3MuZmllbGRzW2ZpZWxkXS50YXJnZXRDbGFzcyxcbiAgICAgICAgICAgIHBhcnNlR3JhcGhRTFNjaGVtYS5wYXJzZUNsYXNzVHlwZXNcbiAgICAgICAgICApO1xuICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAuLi5maWVsZHMsXG4gICAgICAgICAgICAgIFtmaWVsZF06IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgaXMgdGhlIG9iamVjdCAke2ZpZWxkfS5gLFxuICAgICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmllbGRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEFDTDogZGVmYXVsdEdyYXBoUUxUeXBlcy5BQ0xfQVRULFxuICAgICAgICB9XG4gICAgICApLFxuICB9KTtcbiAgcGFyc2VHcmFwaFFMU2NoZW1hLmdyYXBoUUxUeXBlcy5wdXNoKGNsYXNzR3JhcGhRTElucHV0VHlwZSk7XG5cbiAgY29uc3QgY2xhc3NHcmFwaFFMQ29uc3RyYWludFR5cGVOYW1lID0gYCR7Y2xhc3NOYW1lfVBvaW50ZXJDb25zdHJhaW50YDtcbiAgY29uc3QgY2xhc3NHcmFwaFFMQ29uc3RyYWludFR5cGUgPSBuZXcgR3JhcGhRTElucHV0T2JqZWN0VHlwZSh7XG4gICAgbmFtZTogY2xhc3NHcmFwaFFMQ29uc3RyYWludFR5cGVOYW1lLFxuICAgIGRlc2NyaXB0aW9uOiBgVGhlICR7Y2xhc3NHcmFwaFFMQ29uc3RyYWludFR5cGVOYW1lfSBpbnB1dCB0eXBlIGlzIHVzZWQgaW4gb3BlcmF0aW9ucyB0aGF0IGludm9sdmUgZmlsdGVyaW5nIG9iamVjdHMgYnkgYSBwb2ludGVyIGZpZWxkIHRvICR7Y2xhc3NOYW1lfSBjbGFzcy5gLFxuICAgIGZpZWxkczoge1xuICAgICAgX2VxOiBkZWZhdWx0R3JhcGhRTFR5cGVzLl9lcShjbGFzc0dyYXBoUUxTY2FsYXJUeXBlKSxcbiAgICAgIF9uZTogZGVmYXVsdEdyYXBoUUxUeXBlcy5fbmUoY2xhc3NHcmFwaFFMU2NhbGFyVHlwZSksXG4gICAgICBfaW46IGRlZmF1bHRHcmFwaFFMVHlwZXMuX2luKGNsYXNzR3JhcGhRTFNjYWxhclR5cGUpLFxuICAgICAgX25pbjogZGVmYXVsdEdyYXBoUUxUeXBlcy5fbmluKGNsYXNzR3JhcGhRTFNjYWxhclR5cGUpLFxuICAgICAgX2V4aXN0czogZGVmYXVsdEdyYXBoUUxUeXBlcy5fZXhpc3RzLFxuICAgICAgX3NlbGVjdDogZGVmYXVsdEdyYXBoUUxUeXBlcy5fc2VsZWN0LFxuICAgICAgX2RvbnRTZWxlY3Q6IGRlZmF1bHRHcmFwaFFMVHlwZXMuX2RvbnRTZWxlY3QsXG4gICAgICBfaW5RdWVyeToge1xuICAgICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgICAnVGhpcyBpcyB0aGUgJGluUXVlcnkgb3BlcmF0b3IgdG8gc3BlY2lmeSBhIGNvbnN0cmFpbnQgdG8gc2VsZWN0IHRoZSBvYmplY3RzIHdoZXJlIGEgZmllbGQgZXF1YWxzIHRvIGFueSBvZiB0aGUgaWRzIGluIHRoZSByZXN1bHQgb2YgYSBkaWZmZXJlbnQgcXVlcnkuJyxcbiAgICAgICAgdHlwZTogZGVmYXVsdEdyYXBoUUxUeXBlcy5TVUJRVUVSWSxcbiAgICAgIH0sXG4gICAgICBfbm90SW5RdWVyeToge1xuICAgICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgICAnVGhpcyBpcyB0aGUgJG5vdEluUXVlcnkgb3BlcmF0b3IgdG8gc3BlY2lmeSBhIGNvbnN0cmFpbnQgdG8gc2VsZWN0IHRoZSBvYmplY3RzIHdoZXJlIGEgZmllbGQgZG8gbm90IGVxdWFsIHRvIGFueSBvZiB0aGUgaWRzIGluIHRoZSByZXN1bHQgb2YgYSBkaWZmZXJlbnQgcXVlcnkuJyxcbiAgICAgICAgdHlwZTogZGVmYXVsdEdyYXBoUUxUeXBlcy5TVUJRVUVSWSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG4gIHBhcnNlR3JhcGhRTFNjaGVtYS5ncmFwaFFMVHlwZXMucHVzaChjbGFzc0dyYXBoUUxDb25zdHJhaW50VHlwZSk7XG5cbiAgY29uc3QgY2xhc3NHcmFwaFFMQ29uc3RyYWludHNUeXBlTmFtZSA9IGAke2NsYXNzTmFtZX1Db25zdHJhaW50c2A7XG4gIGNvbnN0IGNsYXNzR3JhcGhRTENvbnN0cmFpbnRzVHlwZSA9IG5ldyBHcmFwaFFMSW5wdXRPYmplY3RUeXBlKHtcbiAgICBuYW1lOiBjbGFzc0dyYXBoUUxDb25zdHJhaW50c1R5cGVOYW1lLFxuICAgIGRlc2NyaXB0aW9uOiBgVGhlICR7Y2xhc3NHcmFwaFFMQ29uc3RyYWludHNUeXBlTmFtZX0gaW5wdXQgdHlwZSBpcyB1c2VkIGluIG9wZXJhdGlvbnMgdGhhdCBpbnZvbHZlIGZpbHRlcmluZyBvYmplY3RzIG9mICR7Y2xhc3NOYW1lfSBjbGFzcy5gLFxuICAgIGZpZWxkczogKCkgPT4gKHtcbiAgICAgIC4uLmNsYXNzRmllbGRzLnJlZHVjZSgoZmllbGRzLCBmaWVsZCkgPT4ge1xuICAgICAgICBjb25zdCB0eXBlID0gbWFwQ29uc3RyYWludFR5cGUoXG4gICAgICAgICAgcGFyc2VDbGFzcy5maWVsZHNbZmllbGRdLnR5cGUsXG4gICAgICAgICAgcGFyc2VDbGFzcy5maWVsZHNbZmllbGRdLnRhcmdldENsYXNzLFxuICAgICAgICAgIHBhcnNlR3JhcGhRTFNjaGVtYS5wYXJzZUNsYXNzVHlwZXNcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uZmllbGRzLFxuICAgICAgICAgICAgW2ZpZWxkXToge1xuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgaXMgdGhlIG9iamVjdCAke2ZpZWxkfS5gLFxuICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmaWVsZHM7XG4gICAgICAgIH1cbiAgICAgIH0sIHt9KSxcbiAgICAgIF9vcjoge1xuICAgICAgICBkZXNjcmlwdGlvbjogJ1RoaXMgaXMgdGhlICRvciBvcGVyYXRvciB0byBjb21wb3VuZCBjb25zdHJhaW50cy4nLFxuICAgICAgICB0eXBlOiBuZXcgR3JhcGhRTExpc3QobmV3IEdyYXBoUUxOb25OdWxsKGNsYXNzR3JhcGhRTENvbnN0cmFpbnRzVHlwZSkpLFxuICAgICAgfSxcbiAgICAgIF9hbmQ6IHtcbiAgICAgICAgZGVzY3JpcHRpb246ICdUaGlzIGlzIHRoZSAkYW5kIG9wZXJhdG9yIHRvIGNvbXBvdW5kIGNvbnN0cmFpbnRzLicsXG4gICAgICAgIHR5cGU6IG5ldyBHcmFwaFFMTGlzdChuZXcgR3JhcGhRTE5vbk51bGwoY2xhc3NHcmFwaFFMQ29uc3RyYWludHNUeXBlKSksXG4gICAgICB9LFxuICAgICAgX25vcjoge1xuICAgICAgICBkZXNjcmlwdGlvbjogJ1RoaXMgaXMgdGhlICRub3Igb3BlcmF0b3IgdG8gY29tcG91bmQgY29uc3RyYWludHMuJyxcbiAgICAgICAgdHlwZTogbmV3IEdyYXBoUUxMaXN0KG5ldyBHcmFwaFFMTm9uTnVsbChjbGFzc0dyYXBoUUxDb25zdHJhaW50c1R5cGUpKSxcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pO1xuICBwYXJzZUdyYXBoUUxTY2hlbWEuZ3JhcGhRTFR5cGVzLnB1c2goY2xhc3NHcmFwaFFMQ29uc3RyYWludHNUeXBlKTtcblxuICBjb25zdCBjbGFzc0dyYXBoUUxPcmRlclR5cGVOYW1lID0gYCR7Y2xhc3NOYW1lfU9yZGVyYDtcbiAgY29uc3QgY2xhc3NHcmFwaFFMT3JkZXJUeXBlID0gbmV3IEdyYXBoUUxFbnVtVHlwZSh7XG4gICAgbmFtZTogY2xhc3NHcmFwaFFMT3JkZXJUeXBlTmFtZSxcbiAgICBkZXNjcmlwdGlvbjogYFRoZSAke2NsYXNzR3JhcGhRTE9yZGVyVHlwZU5hbWV9IGlucHV0IHR5cGUgaXMgdXNlZCB3aGVuIHNvcnRpbmcgb2JqZWN0cyBvZiB0aGUgJHtjbGFzc05hbWV9IGNsYXNzLmAsXG4gICAgdmFsdWVzOiBjbGFzc0ZpZWxkcy5yZWR1Y2UoKG9yZGVyRmllbGRzLCBmaWVsZCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ub3JkZXJGaWVsZHMsXG4gICAgICAgIFtgJHtmaWVsZH1fQVNDYF06IHsgdmFsdWU6IGZpZWxkIH0sXG4gICAgICAgIFtgJHtmaWVsZH1fREVTQ2BdOiB7IHZhbHVlOiBgLSR7ZmllbGR9YCB9LFxuICAgICAgfTtcbiAgICB9LCB7fSksXG4gIH0pO1xuICBwYXJzZUdyYXBoUUxTY2hlbWEuZ3JhcGhRTFR5cGVzLnB1c2goY2xhc3NHcmFwaFFMT3JkZXJUeXBlKTtcblxuICBjb25zdCBjbGFzc0dyYXBoUUxGaW5kQXJncyA9IHtcbiAgICB3aGVyZToge1xuICAgICAgZGVzY3JpcHRpb246XG4gICAgICAgICdUaGVzZSBhcmUgdGhlIGNvbmRpdGlvbnMgdGhhdCB0aGUgb2JqZWN0cyBuZWVkIHRvIG1hdGNoIGluIG9yZGVyIHRvIGJlIGZvdW5kLicsXG4gICAgICB0eXBlOiBjbGFzc0dyYXBoUUxDb25zdHJhaW50c1R5cGUsXG4gICAgfSxcbiAgICBvcmRlcjoge1xuICAgICAgZGVzY3JpcHRpb246ICdUaGUgZmllbGRzIHRvIGJlIHVzZWQgd2hlbiBzb3J0aW5nIHRoZSBkYXRhIGZldGNoZWQuJyxcbiAgICAgIHR5cGU6IG5ldyBHcmFwaFFMTGlzdChuZXcgR3JhcGhRTE5vbk51bGwoY2xhc3NHcmFwaFFMT3JkZXJUeXBlKSksXG4gICAgfSxcbiAgICBza2lwOiBkZWZhdWx0R3JhcGhRTFR5cGVzLlNLSVBfQVRULFxuICAgIGxpbWl0OiBkZWZhdWx0R3JhcGhRTFR5cGVzLkxJTUlUX0FUVCxcbiAgICByZWFkUHJlZmVyZW5jZTogZGVmYXVsdEdyYXBoUUxUeXBlcy5SRUFEX1BSRUZFUkVOQ0VfQVRULFxuICAgIGluY2x1ZGVSZWFkUHJlZmVyZW5jZTogZGVmYXVsdEdyYXBoUUxUeXBlcy5JTkNMVURFX1JFQURfUFJFRkVSRU5DRV9BVFQsXG4gICAgc3VicXVlcnlSZWFkUHJlZmVyZW5jZTogZGVmYXVsdEdyYXBoUUxUeXBlcy5TVUJRVUVSWV9SRUFEX1BSRUZFUkVOQ0VfQVRULFxuICB9O1xuXG4gIGNvbnN0IGNsYXNzR3JhcGhRTE91dHB1dFR5cGVOYW1lID0gYCR7Y2xhc3NOYW1lfUNsYXNzYDtcbiAgY29uc3Qgb3V0cHV0RmllbGRzID0gKCkgPT4ge1xuICAgIHJldHVybiBjbGFzc0N1c3RvbUZpZWxkcy5yZWR1Y2UoKGZpZWxkcywgZmllbGQpID0+IHtcbiAgICAgIGNvbnN0IHR5cGUgPSBtYXBPdXRwdXRUeXBlKFxuICAgICAgICBwYXJzZUNsYXNzLmZpZWxkc1tmaWVsZF0udHlwZSxcbiAgICAgICAgcGFyc2VDbGFzcy5maWVsZHNbZmllbGRdLnRhcmdldENsYXNzLFxuICAgICAgICBwYXJzZUdyYXBoUUxTY2hlbWEucGFyc2VDbGFzc1R5cGVzXG4gICAgICApO1xuICAgICAgaWYgKHBhcnNlQ2xhc3MuZmllbGRzW2ZpZWxkXS50eXBlID09PSAnUmVsYXRpb24nKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldFBhcnNlQ2xhc3NUeXBlcyA9XG4gICAgICAgICAgcGFyc2VHcmFwaFFMU2NoZW1hLnBhcnNlQ2xhc3NUeXBlc1tcbiAgICAgICAgICAgIHBhcnNlQ2xhc3MuZmllbGRzW2ZpZWxkXS50YXJnZXRDbGFzc1xuICAgICAgICAgIF07XG4gICAgICAgIGNvbnN0IGFyZ3MgPSB0YXJnZXRQYXJzZUNsYXNzVHlwZXNcbiAgICAgICAgICA/IHRhcmdldFBhcnNlQ2xhc3NUeXBlcy5jbGFzc0dyYXBoUUxGaW5kQXJnc1xuICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLmZpZWxkcyxcbiAgICAgICAgICBbZmllbGRdOiB7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgaXMgdGhlIG9iamVjdCAke2ZpZWxkfS5gLFxuICAgICAgICAgICAgYXJncyxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICBhc3luYyByZXNvbHZlKHNvdXJjZSwgYXJncywgY29udGV4dCwgcXVlcnlJbmZvKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgICAgICAgd2hlcmUsXG4gICAgICAgICAgICAgICAgICBvcmRlcixcbiAgICAgICAgICAgICAgICAgIHNraXAsXG4gICAgICAgICAgICAgICAgICBsaW1pdCxcbiAgICAgICAgICAgICAgICAgIHJlYWRQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgaW5jbHVkZVJlYWRQcmVmZXJlbmNlLFxuICAgICAgICAgICAgICAgICAgc3VicXVlcnlSZWFkUHJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICB9ID0gYXJncztcbiAgICAgICAgICAgICAgICBjb25zdCB7IGNvbmZpZywgYXV0aCwgaW5mbyB9ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWxlY3RlZEZpZWxkcyA9IGdldEZpZWxkTmFtZXMocXVlcnlJbmZvKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHsga2V5cywgaW5jbHVkZSB9ID0gZXh0cmFjdEtleXNBbmRJbmNsdWRlKFxuICAgICAgICAgICAgICAgICAgc2VsZWN0ZWRGaWVsZHNcbiAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihmaWVsZCA9PiBmaWVsZC5pbmNsdWRlcygnLicpKVxuICAgICAgICAgICAgICAgICAgICAubWFwKGZpZWxkID0+IGZpZWxkLnNsaWNlKGZpZWxkLmluZGV4T2YoJy4nKSArIDEpKVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgb2JqZWN0c1F1ZXJpZXMuZmluZE9iamVjdHMoXG4gICAgICAgICAgICAgICAgICBzb3VyY2VbZmllbGRdLmNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgX3JlbGF0ZWRUbzoge1xuICAgICAgICAgICAgICAgICAgICAgIG9iamVjdDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgX190eXBlOiAnUG9pbnRlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RJZDogc291cmNlLm9iamVjdElkLFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAga2V5OiBmaWVsZCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgLi4uKHdoZXJlIHx8IHt9KSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBvcmRlcixcbiAgICAgICAgICAgICAgICAgIHNraXAsXG4gICAgICAgICAgICAgICAgICBsaW1pdCxcbiAgICAgICAgICAgICAgICAgIGtleXMsXG4gICAgICAgICAgICAgICAgICBpbmNsdWRlLFxuICAgICAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICAgICByZWFkUHJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICAgIGluY2x1ZGVSZWFkUHJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICAgIHN1YnF1ZXJ5UmVhZFByZWZlcmVuY2UsXG4gICAgICAgICAgICAgICAgICBjb25maWcsXG4gICAgICAgICAgICAgICAgICBhdXRoLFxuICAgICAgICAgICAgICAgICAgaW5mbyxcbiAgICAgICAgICAgICAgICAgIHNlbGVjdGVkRmllbGRzLm1hcChmaWVsZCA9PiBmaWVsZC5zcGxpdCgnLicsIDEpWzBdKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBwYXJzZUdyYXBoUUxTY2hlbWEuaGFuZGxlRXJyb3IoZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAocGFyc2VDbGFzcy5maWVsZHNbZmllbGRdLnR5cGUgPT09ICdQb2x5Z29uJykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLmZpZWxkcyxcbiAgICAgICAgICBbZmllbGRdOiB7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgaXMgdGhlIG9iamVjdCAke2ZpZWxkfS5gLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGFzeW5jIHJlc29sdmUoc291cmNlKSB7XG4gICAgICAgICAgICAgIGlmIChzb3VyY2VbZmllbGRdICYmIHNvdXJjZVtmaWVsZF0uY29vcmRpbmF0ZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc291cmNlW2ZpZWxkXS5jb29yZGluYXRlcy5tYXAoY29vcmRpbmF0ZSA9PiAoe1xuICAgICAgICAgICAgICAgICAgbGF0aXR1ZGU6IGNvb3JkaW5hdGVbMF0sXG4gICAgICAgICAgICAgICAgICBsb25naXR1ZGU6IGNvb3JkaW5hdGVbMV0sXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKHR5cGUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5maWVsZHMsXG4gICAgICAgICAgW2ZpZWxkXToge1xuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBUaGlzIGlzIHRoZSBvYmplY3QgJHtmaWVsZH0uYCxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmaWVsZHM7XG4gICAgICB9XG4gICAgfSwgZGVmYXVsdEdyYXBoUUxUeXBlcy5DTEFTU19GSUVMRFMpO1xuICB9O1xuICBjb25zdCBjbGFzc0dyYXBoUUxPdXRwdXRUeXBlID0gbmV3IEdyYXBoUUxPYmplY3RUeXBlKHtcbiAgICBuYW1lOiBjbGFzc0dyYXBoUUxPdXRwdXRUeXBlTmFtZSxcbiAgICBkZXNjcmlwdGlvbjogYFRoZSAke2NsYXNzR3JhcGhRTE91dHB1dFR5cGVOYW1lfSBvYmplY3QgdHlwZSBpcyB1c2VkIGluIG9wZXJhdGlvbnMgdGhhdCBpbnZvbHZlIG91dHB1dHRpbmcgb2JqZWN0cyBvZiAke2NsYXNzTmFtZX0gY2xhc3MuYCxcbiAgICBpbnRlcmZhY2VzOiBbZGVmYXVsdEdyYXBoUUxUeXBlcy5DTEFTU10sXG4gICAgZmllbGRzOiBvdXRwdXRGaWVsZHMsXG4gIH0pO1xuICBwYXJzZUdyYXBoUUxTY2hlbWEuZ3JhcGhRTFR5cGVzLnB1c2goY2xhc3NHcmFwaFFMT3V0cHV0VHlwZSk7XG5cbiAgY29uc3QgY2xhc3NHcmFwaFFMRmluZFJlc3VsdFR5cGVOYW1lID0gYCR7Y2xhc3NOYW1lfUZpbmRSZXN1bHRgO1xuICBjb25zdCBjbGFzc0dyYXBoUUxGaW5kUmVzdWx0VHlwZSA9IG5ldyBHcmFwaFFMT2JqZWN0VHlwZSh7XG4gICAgbmFtZTogY2xhc3NHcmFwaFFMRmluZFJlc3VsdFR5cGVOYW1lLFxuICAgIGRlc2NyaXB0aW9uOiBgVGhlICR7Y2xhc3NHcmFwaFFMRmluZFJlc3VsdFR5cGVOYW1lfSBvYmplY3QgdHlwZSBpcyB1c2VkIGluIHRoZSAke2NsYXNzTmFtZX0gZmluZCBxdWVyeSB0byByZXR1cm4gdGhlIGRhdGEgb2YgdGhlIG1hdGNoZWQgb2JqZWN0cy5gLFxuICAgIGZpZWxkczoge1xuICAgICAgcmVzdWx0czoge1xuICAgICAgICBkZXNjcmlwdGlvbjogJ1RoaXMgaXMgdGhlIG9iamVjdHMgcmV0dXJuZWQgYnkgdGhlIHF1ZXJ5JyxcbiAgICAgICAgdHlwZTogbmV3IEdyYXBoUUxOb25OdWxsKFxuICAgICAgICAgIG5ldyBHcmFwaFFMTGlzdChuZXcgR3JhcGhRTE5vbk51bGwoY2xhc3NHcmFwaFFMT3V0cHV0VHlwZSkpXG4gICAgICAgICksXG4gICAgICB9LFxuICAgICAgY291bnQ6IGRlZmF1bHRHcmFwaFFMVHlwZXMuQ09VTlRfQVRULFxuICAgIH0sXG4gIH0pO1xuICBwYXJzZUdyYXBoUUxTY2hlbWEuZ3JhcGhRTFR5cGVzLnB1c2goY2xhc3NHcmFwaFFMRmluZFJlc3VsdFR5cGUpO1xuXG4gIHBhcnNlR3JhcGhRTFNjaGVtYS5wYXJzZUNsYXNzVHlwZXNbY2xhc3NOYW1lXSA9IHtcbiAgICBjbGFzc0dyYXBoUUxTY2FsYXJUeXBlLFxuICAgIGNsYXNzR3JhcGhRTFJlbGF0aW9uT3BUeXBlLFxuICAgIGNsYXNzR3JhcGhRTElucHV0VHlwZSxcbiAgICBjbGFzc0dyYXBoUUxDb25zdHJhaW50VHlwZSxcbiAgICBjbGFzc0dyYXBoUUxDb25zdHJhaW50c1R5cGUsXG4gICAgY2xhc3NHcmFwaFFMRmluZEFyZ3MsXG4gICAgY2xhc3NHcmFwaFFMT3V0cHV0VHlwZSxcbiAgICBjbGFzc0dyYXBoUUxGaW5kUmVzdWx0VHlwZSxcbiAgfTtcblxuICBpZiAoY2xhc3NOYW1lID09PSAnX1VzZXInKSB7XG4gICAgY29uc3QgbWVUeXBlID0gbmV3IEdyYXBoUUxPYmplY3RUeXBlKHtcbiAgICAgIG5hbWU6ICdNZScsXG4gICAgICBkZXNjcmlwdGlvbjogYFRoZSBNZSBvYmplY3QgdHlwZSBpcyB1c2VkIGluIG9wZXJhdGlvbnMgdGhhdCBpbnZvbHZlIG91dHB1dHRpbmcgdGhlIGN1cnJlbnQgdXNlciBkYXRhLmAsXG4gICAgICBpbnRlcmZhY2VzOiBbZGVmYXVsdEdyYXBoUUxUeXBlcy5DTEFTU10sXG4gICAgICBmaWVsZHM6ICgpID0+ICh7XG4gICAgICAgIC4uLm91dHB1dEZpZWxkcygpLFxuICAgICAgICBzZXNzaW9uVG9rZW46IGRlZmF1bHRHcmFwaFFMVHlwZXMuU0VTU0lPTl9UT0tFTl9BVFQsXG4gICAgICB9KSxcbiAgICB9KTtcbiAgICBwYXJzZUdyYXBoUUxTY2hlbWEubWVUeXBlID0gbWVUeXBlO1xuICAgIHBhcnNlR3JhcGhRTFNjaGVtYS5ncmFwaFFMVHlwZXMucHVzaChtZVR5cGUpO1xuXG4gICAgY29uc3QgdXNlclNpZ25VcElucHV0VHlwZU5hbWUgPSBgX1VzZXJTaWduVXBGaWVsZHNgO1xuICAgIGNvbnN0IHVzZXJTaWduVXBJbnB1dFR5cGUgPSBuZXcgR3JhcGhRTElucHV0T2JqZWN0VHlwZSh7XG4gICAgICBuYW1lOiB1c2VyU2lnblVwSW5wdXRUeXBlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVGhlICR7dXNlclNpZ25VcElucHV0VHlwZU5hbWV9IGlucHV0IHR5cGUgaXMgdXNlZCBpbiBvcGVyYXRpb25zIHRoYXQgaW52b2x2ZSBpbnB1dHRpbmcgb2JqZWN0cyBvZiAke2NsYXNzTmFtZX0gY2xhc3Mgd2hlbiBzaWduaW5nIHVwLmAsXG4gICAgICBmaWVsZHM6ICgpID0+XG4gICAgICAgIGNsYXNzQ3VzdG9tRmllbGRzLnJlZHVjZShcbiAgICAgICAgICAoZmllbGRzLCBmaWVsZCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9IG1hcElucHV0VHlwZShcbiAgICAgICAgICAgICAgcGFyc2VDbGFzcy5maWVsZHNbZmllbGRdLnR5cGUsXG4gICAgICAgICAgICAgIHBhcnNlQ2xhc3MuZmllbGRzW2ZpZWxkXS50YXJnZXRDbGFzcyxcbiAgICAgICAgICAgICAgcGFyc2VHcmFwaFFMU2NoZW1hLnBhcnNlQ2xhc3NUeXBlc1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgLi4uZmllbGRzLFxuICAgICAgICAgICAgICAgIFtmaWVsZF06IHtcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgVGhpcyBpcyB0aGUgb2JqZWN0ICR7ZmllbGR9LmAsXG4gICAgICAgICAgICAgICAgICB0eXBlOlxuICAgICAgICAgICAgICAgICAgICBmaWVsZCA9PT0gJ3VzZXJuYW1lJyB8fCBmaWVsZCA9PT0gJ3Bhc3N3b3JkJ1xuICAgICAgICAgICAgICAgICAgICAgID8gbmV3IEdyYXBoUUxOb25OdWxsKHR5cGUpXG4gICAgICAgICAgICAgICAgICAgICAgOiB0eXBlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gZmllbGRzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgQUNMOiBkZWZhdWx0R3JhcGhRTFR5cGVzLkFDTF9BVFQsXG4gICAgICAgICAgfVxuICAgICAgICApLFxuICAgIH0pO1xuICAgIHBhcnNlR3JhcGhRTFNjaGVtYS5wYXJzZUNsYXNzVHlwZXNbXG4gICAgICAnX1VzZXInXG4gICAgXS5zaWduVXBJbnB1dFR5cGUgPSB1c2VyU2lnblVwSW5wdXRUeXBlO1xuICAgIHBhcnNlR3JhcGhRTFNjaGVtYS5ncmFwaFFMVHlwZXMucHVzaCh1c2VyU2lnblVwSW5wdXRUeXBlKTtcbiAgfVxufTtcblxuZXhwb3J0IHsgZXh0cmFjdEtleXNBbmRJbmNsdWRlLCBsb2FkIH07XG4iXX0=