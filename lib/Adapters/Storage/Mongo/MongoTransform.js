"use strict";

var _logger = _interopRequireDefault(require("../../../logger"));

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var mongodb = require('mongodb');

var Parse = require('parse/node').Parse;

const transformKey = (className, fieldName, schema) => {
  // Check if the schema is known since it's a built-in field.
  switch (fieldName) {
    case 'objectId':
      return '_id';

    case 'createdAt':
      return '_created_at';

    case 'updatedAt':
      return '_updated_at';

    case 'sessionToken':
      return '_session_token';

    case 'lastUsed':
      return '_last_used';

    case 'timesUsed':
      return 'times_used';
  }

  if (schema.fields[fieldName] && schema.fields[fieldName].__type == 'Pointer') {
    fieldName = '_p_' + fieldName;
  } else if (schema.fields[fieldName] && schema.fields[fieldName].type == 'Pointer') {
    fieldName = '_p_' + fieldName;
  }

  return fieldName;
};

const transformKeyValueForUpdate = (className, restKey, restValue, parseFormatSchema) => {
  // Check if the schema is known since it's a built-in field.
  var key = restKey;
  var timeField = false;

  switch (key) {
    case 'objectId':
    case '_id':
      if (className === '_GlobalConfig') {
        return {
          key: key,
          value: parseInt(restValue)
        };
      }

      key = '_id';
      break;

    case 'createdAt':
    case '_created_at':
      key = '_created_at';
      timeField = true;
      break;

    case 'updatedAt':
    case '_updated_at':
      key = '_updated_at';
      timeField = true;
      break;

    case 'sessionToken':
    case '_session_token':
      key = '_session_token';
      break;

    case 'expiresAt':
    case '_expiresAt':
      key = 'expiresAt';
      timeField = true;
      break;

    case '_email_verify_token_expires_at':
      key = '_email_verify_token_expires_at';
      timeField = true;
      break;

    case '_account_lockout_expires_at':
      key = '_account_lockout_expires_at';
      timeField = true;
      break;

    case '_failed_login_count':
      key = '_failed_login_count';
      break;

    case '_perishable_token_expires_at':
      key = '_perishable_token_expires_at';
      timeField = true;
      break;

    case '_password_changed_at':
      key = '_password_changed_at';
      timeField = true;
      break;

    case '_rperm':
    case '_wperm':
      return {
        key: key,
        value: restValue
      };

    case 'lastUsed':
    case '_last_used':
      key = '_last_used';
      timeField = true;
      break;

    case 'timesUsed':
    case 'times_used':
      key = 'times_used';
      timeField = true;
      break;
  }

  if (parseFormatSchema.fields[key] && parseFormatSchema.fields[key].type === 'Pointer' || !parseFormatSchema.fields[key] && restValue && restValue.__type == 'Pointer') {
    key = '_p_' + key;
  } // Handle atomic values


  var value = transformTopLevelAtom(restValue);

  if (value !== CannotTransform) {
    if (timeField && typeof value === 'string') {
      value = new Date(value);
    }

    if (restKey.indexOf('.') > 0) {
      return {
        key,
        value: restValue
      };
    }

    return {
      key,
      value
    };
  } // Handle arrays


  if (restValue instanceof Array) {
    value = restValue.map(transformInteriorValue);
    return {
      key,
      value
    };
  } // Handle update operators


  if (typeof restValue === 'object' && '__op' in restValue) {
    return {
      key,
      value: transformUpdateOperator(restValue, false)
    };
  } // Handle normal objects by recursing


  value = mapValues(restValue, transformInteriorValue);
  return {
    key,
    value
  };
};

const isRegex = value => {
  return value && value instanceof RegExp;
};

const isStartsWithRegex = value => {
  if (!isRegex(value)) {
    return false;
  }

  const matches = value.toString().match(/\/\^\\Q.*\\E\//);
  return !!matches;
};

const isAllValuesRegexOrNone = values => {
  if (!values || !Array.isArray(values) || values.length === 0) {
    return true;
  }

  const firstValuesIsRegex = isStartsWithRegex(values[0]);

  if (values.length === 1) {
    return firstValuesIsRegex;
  }

  for (let i = 1, length = values.length; i < length; ++i) {
    if (firstValuesIsRegex !== isStartsWithRegex(values[i])) {
      return false;
    }
  }

  return true;
};

const isAnyValueRegex = values => {
  return values.some(function (value) {
    return isRegex(value);
  });
};

const transformInteriorValue = restValue => {
  if (restValue !== null && typeof restValue === 'object' && Object.keys(restValue).some(key => key.includes('$') || key.includes('.'))) {
    throw new Parse.Error(Parse.Error.INVALID_NESTED_KEY, "Nested keys should not contain the '$' or '.' characters");
  } // Handle atomic values


  var value = transformInteriorAtom(restValue);

  if (value !== CannotTransform) {
    return value;
  } // Handle arrays


  if (restValue instanceof Array) {
    return restValue.map(transformInteriorValue);
  } // Handle update operators


  if (typeof restValue === 'object' && '__op' in restValue) {
    return transformUpdateOperator(restValue, true);
  } // Handle normal objects by recursing


  return mapValues(restValue, transformInteriorValue);
};

const valueAsDate = value => {
  if (typeof value === 'string') {
    return new Date(value);
  } else if (value instanceof Date) {
    return value;
  }

  return false;
};

function transformQueryKeyValue(className, key, value, schema, count = false) {
  switch (key) {
    case 'createdAt':
      if (valueAsDate(value)) {
        return {
          key: '_created_at',
          value: valueAsDate(value)
        };
      }

      key = '_created_at';
      break;

    case 'updatedAt':
      if (valueAsDate(value)) {
        return {
          key: '_updated_at',
          value: valueAsDate(value)
        };
      }

      key = '_updated_at';
      break;

    case 'expiresAt':
      if (valueAsDate(value)) {
        return {
          key: 'expiresAt',
          value: valueAsDate(value)
        };
      }

      break;

    case '_email_verify_token_expires_at':
      if (valueAsDate(value)) {
        return {
          key: '_email_verify_token_expires_at',
          value: valueAsDate(value)
        };
      }

      break;

    case 'objectId':
      {
        if (className === '_GlobalConfig') {
          value = parseInt(value);
        }

        return {
          key: '_id',
          value
        };
      }

    case '_account_lockout_expires_at':
      if (valueAsDate(value)) {
        return {
          key: '_account_lockout_expires_at',
          value: valueAsDate(value)
        };
      }

      break;

    case '_failed_login_count':
      return {
        key,
        value
      };

    case 'sessionToken':
      return {
        key: '_session_token',
        value
      };

    case '_perishable_token_expires_at':
      if (valueAsDate(value)) {
        return {
          key: '_perishable_token_expires_at',
          value: valueAsDate(value)
        };
      }

      break;

    case '_password_changed_at':
      if (valueAsDate(value)) {
        return {
          key: '_password_changed_at',
          value: valueAsDate(value)
        };
      }

      break;

    case '_rperm':
    case '_wperm':
    case '_perishable_token':
    case '_email_verify_token':
      return {
        key,
        value
      };

    case '$or':
    case '$and':
    case '$nor':
      return {
        key: key,
        value: value.map(subQuery => transformWhere(className, subQuery, schema, count))
      };

    case 'lastUsed':
      if (valueAsDate(value)) {
        return {
          key: '_last_used',
          value: valueAsDate(value)
        };
      }

      key = '_last_used';
      break;

    case 'timesUsed':
      return {
        key: 'times_used',
        value: value
      };

    default:
      {
        // Other auth data
        const authDataMatch = key.match(/^authData\.([a-zA-Z0-9_]+)\.id$/);

        if (authDataMatch) {
          const provider = authDataMatch[1]; // Special-case auth data.

          return {
            key: `_auth_data_${provider}.id`,
            value
          };
        }
      }
  }

  const expectedTypeIsArray = schema && schema.fields[key] && schema.fields[key].type === 'Array';
  const expectedTypeIsPointer = schema && schema.fields[key] && schema.fields[key].type === 'Pointer';
  const field = schema && schema.fields[key];

  if (expectedTypeIsPointer || !schema && value && value.__type === 'Pointer') {
    key = '_p_' + key;
  } // Handle query constraints


  const transformedConstraint = transformConstraint(value, field, count);

  if (transformedConstraint !== CannotTransform) {
    if (transformedConstraint.$text) {
      return {
        key: '$text',
        value: transformedConstraint.$text
      };
    }

    if (transformedConstraint.$elemMatch) {
      return {
        key: '$nor',
        value: [{
          [key]: transformedConstraint
        }]
      };
    }

    return {
      key,
      value: transformedConstraint
    };
  }

  if (expectedTypeIsArray && !(value instanceof Array)) {
    return {
      key,
      value: {
        $all: [transformInteriorAtom(value)]
      }
    };
  } // Handle atomic values


  if (transformTopLevelAtom(value) !== CannotTransform) {
    return {
      key,
      value: transformTopLevelAtom(value)
    };
  } else {
    throw new Parse.Error(Parse.Error.INVALID_JSON, `You cannot use ${value} as a query parameter.`);
  }
} // Main exposed method to help run queries.
// restWhere is the "where" clause in REST API form.
// Returns the mongo form of the query.


function transformWhere(className, restWhere, schema, count = false) {
  const mongoWhere = {};

  for (const restKey in restWhere) {
    const out = transformQueryKeyValue(className, restKey, restWhere[restKey], schema, count);
    mongoWhere[out.key] = out.value;
  }

  return mongoWhere;
}

const parseObjectKeyValueToMongoObjectKeyValue = (restKey, restValue, schema) => {
  // Check if the schema is known since it's a built-in field.
  let transformedValue;
  let coercedToDate;

  switch (restKey) {
    case 'objectId':
      return {
        key: '_id',
        value: restValue
      };

    case 'expiresAt':
      transformedValue = transformTopLevelAtom(restValue);
      coercedToDate = typeof transformedValue === 'string' ? new Date(transformedValue) : transformedValue;
      return {
        key: 'expiresAt',
        value: coercedToDate
      };

    case '_email_verify_token_expires_at':
      transformedValue = transformTopLevelAtom(restValue);
      coercedToDate = typeof transformedValue === 'string' ? new Date(transformedValue) : transformedValue;
      return {
        key: '_email_verify_token_expires_at',
        value: coercedToDate
      };

    case '_account_lockout_expires_at':
      transformedValue = transformTopLevelAtom(restValue);
      coercedToDate = typeof transformedValue === 'string' ? new Date(transformedValue) : transformedValue;
      return {
        key: '_account_lockout_expires_at',
        value: coercedToDate
      };

    case '_perishable_token_expires_at':
      transformedValue = transformTopLevelAtom(restValue);
      coercedToDate = typeof transformedValue === 'string' ? new Date(transformedValue) : transformedValue;
      return {
        key: '_perishable_token_expires_at',
        value: coercedToDate
      };

    case '_password_changed_at':
      transformedValue = transformTopLevelAtom(restValue);
      coercedToDate = typeof transformedValue === 'string' ? new Date(transformedValue) : transformedValue;
      return {
        key: '_password_changed_at',
        value: coercedToDate
      };

    case '_failed_login_count':
    case '_rperm':
    case '_wperm':
    case '_email_verify_token':
    case '_hashed_password':
    case '_perishable_token':
      return {
        key: restKey,
        value: restValue
      };

    case 'sessionToken':
      return {
        key: '_session_token',
        value: restValue
      };

    default:
      // Auth data should have been transformed already
      if (restKey.match(/^authData\.([a-zA-Z0-9_]+)\.id$/)) {
        throw new Parse.Error(Parse.Error.INVALID_KEY_NAME, 'can only query on ' + restKey);
      } // Trust that the auth data has been transformed and save it directly


      if (restKey.match(/^_auth_data_[a-zA-Z0-9_]+$/)) {
        return {
          key: restKey,
          value: restValue
        };
      }

  } //skip straight to transformTopLevelAtom for Bytes, they don't show up in the schema for some reason


  if (restValue && restValue.__type !== 'Bytes') {
    //Note: We may not know the type of a field here, as the user could be saving (null) to a field
    //That never existed before, meaning we can't infer the type.
    if (schema.fields[restKey] && schema.fields[restKey].type == 'Pointer' || restValue.__type == 'Pointer') {
      restKey = '_p_' + restKey;
    }
  } // Handle atomic values


  var value = transformTopLevelAtom(restValue);

  if (value !== CannotTransform) {
    return {
      key: restKey,
      value: value
    };
  } // ACLs are handled before this method is called
  // If an ACL key still exists here, something is wrong.


  if (restKey === 'ACL') {
    throw 'There was a problem transforming an ACL.';
  } // Handle arrays


  if (restValue instanceof Array) {
    value = restValue.map(transformInteriorValue);
    return {
      key: restKey,
      value: value
    };
  } // Handle normal objects by recursing


  if (Object.keys(restValue).some(key => key.includes('$') || key.includes('.'))) {
    throw new Parse.Error(Parse.Error.INVALID_NESTED_KEY, "Nested keys should not contain the '$' or '.' characters");
  }

  value = mapValues(restValue, transformInteriorValue);
  return {
    key: restKey,
    value
  };
};

const parseObjectToMongoObjectForCreate = (className, restCreate, schema) => {
  restCreate = addLegacyACL(restCreate);
  const mongoCreate = {};

  for (const restKey in restCreate) {
    if (restCreate[restKey] && restCreate[restKey].__type === 'Relation') {
      continue;
    }

    const {
      key,
      value
    } = parseObjectKeyValueToMongoObjectKeyValue(restKey, restCreate[restKey], schema);

    if (value !== undefined) {
      mongoCreate[key] = value;
    }
  } // Use the legacy mongo format for createdAt and updatedAt


  if (mongoCreate.createdAt) {
    mongoCreate._created_at = new Date(mongoCreate.createdAt.iso || mongoCreate.createdAt);
    delete mongoCreate.createdAt;
  }

  if (mongoCreate.updatedAt) {
    mongoCreate._updated_at = new Date(mongoCreate.updatedAt.iso || mongoCreate.updatedAt);
    delete mongoCreate.updatedAt;
  }

  return mongoCreate;
}; // Main exposed method to help update old objects.


const transformUpdate = (className, restUpdate, parseFormatSchema) => {
  const mongoUpdate = {};
  const acl = addLegacyACL(restUpdate);

  if (acl._rperm || acl._wperm || acl._acl) {
    mongoUpdate.$set = {};

    if (acl._rperm) {
      mongoUpdate.$set._rperm = acl._rperm;
    }

    if (acl._wperm) {
      mongoUpdate.$set._wperm = acl._wperm;
    }

    if (acl._acl) {
      mongoUpdate.$set._acl = acl._acl;
    }
  }

  for (var restKey in restUpdate) {
    if (restUpdate[restKey] && restUpdate[restKey].__type === 'Relation') {
      continue;
    }

    var out = transformKeyValueForUpdate(className, restKey, restUpdate[restKey], parseFormatSchema); // If the output value is an object with any $ keys, it's an
    // operator that needs to be lifted onto the top level update
    // object.

    if (typeof out.value === 'object' && out.value !== null && out.value.__op) {
      mongoUpdate[out.value.__op] = mongoUpdate[out.value.__op] || {};
      mongoUpdate[out.value.__op][out.key] = out.value.arg;
    } else {
      mongoUpdate['$set'] = mongoUpdate['$set'] || {};
      mongoUpdate['$set'][out.key] = out.value;
    }
  }

  return mongoUpdate;
}; // Add the legacy _acl format.


const addLegacyACL = restObject => {
  const restObjectCopy = _objectSpread({}, restObject);

  const _acl = {};

  if (restObject._wperm) {
    restObject._wperm.forEach(entry => {
      _acl[entry] = {
        w: true
      };
    });

    restObjectCopy._acl = _acl;
  }

  if (restObject._rperm) {
    restObject._rperm.forEach(entry => {
      if (!(entry in _acl)) {
        _acl[entry] = {
          r: true
        };
      } else {
        _acl[entry].r = true;
      }
    });

    restObjectCopy._acl = _acl;
  }

  return restObjectCopy;
}; // A sentinel value that helper transformations return when they
// cannot perform a transformation


function CannotTransform() {}

const transformInteriorAtom = atom => {
  // TODO: check validity harder for the __type-defined types
  if (typeof atom === 'object' && atom && !(atom instanceof Date) && atom.__type === 'Pointer') {
    return {
      __type: 'Pointer',
      className: atom.className,
      objectId: atom.objectId
    };
  } else if (typeof atom === 'function' || typeof atom === 'symbol') {
    throw new Parse.Error(Parse.Error.INVALID_JSON, `cannot transform value: ${atom}`);
  } else if (DateCoder.isValidJSON(atom)) {
    return DateCoder.JSONToDatabase(atom);
  } else if (BytesCoder.isValidJSON(atom)) {
    return BytesCoder.JSONToDatabase(atom);
  } else if (typeof atom === 'object' && atom && atom.$regex !== undefined) {
    return new RegExp(atom.$regex);
  } else {
    return atom;
  }
}; // Helper function to transform an atom from REST format to Mongo format.
// An atom is anything that can't contain other expressions. So it
// includes things where objects are used to represent other
// datatypes, like pointers and dates, but it does not include objects
// or arrays with generic stuff inside.
// Raises an error if this cannot possibly be valid REST format.
// Returns CannotTransform if it's just not an atom


function transformTopLevelAtom(atom, field) {
  switch (typeof atom) {
    case 'number':
    case 'boolean':
    case 'undefined':
      return atom;

    case 'string':
      if (field && field.type === 'Pointer') {
        return `${field.targetClass}$${atom}`;
      }

      return atom;

    case 'symbol':
    case 'function':
      throw new Parse.Error(Parse.Error.INVALID_JSON, `cannot transform value: ${atom}`);

    case 'object':
      if (atom instanceof Date) {
        // Technically dates are not rest format, but, it seems pretty
        // clear what they should be transformed to, so let's just do it.
        return atom;
      }

      if (atom === null) {
        return atom;
      } // TODO: check validity harder for the __type-defined types


      if (atom.__type == 'Pointer') {
        return `${atom.className}$${atom.objectId}`;
      }

      if (DateCoder.isValidJSON(atom)) {
        return DateCoder.JSONToDatabase(atom);
      }

      if (BytesCoder.isValidJSON(atom)) {
        return BytesCoder.JSONToDatabase(atom);
      }

      if (GeoPointCoder.isValidJSON(atom)) {
        return GeoPointCoder.JSONToDatabase(atom);
      }

      if (PolygonCoder.isValidJSON(atom)) {
        return PolygonCoder.JSONToDatabase(atom);
      }

      if (FileCoder.isValidJSON(atom)) {
        return FileCoder.JSONToDatabase(atom);
      }

      return CannotTransform;

    default:
      // I don't think typeof can ever let us get here
      throw new Parse.Error(Parse.Error.INTERNAL_SERVER_ERROR, `really did not expect value: ${atom}`);
  }
}

function relativeTimeToDate(text, now = new Date()) {
  text = text.toLowerCase();
  let parts = text.split(' '); // Filter out whitespace

  parts = parts.filter(part => part !== '');
  const future = parts[0] === 'in';
  const past = parts[parts.length - 1] === 'ago';

  if (!future && !past && text !== 'now') {
    return {
      status: 'error',
      info: "Time should either start with 'in' or end with 'ago'"
    };
  }

  if (future && past) {
    return {
      status: 'error',
      info: "Time cannot have both 'in' and 'ago'"
    };
  } // strip the 'ago' or 'in'


  if (future) {
    parts = parts.slice(1);
  } else {
    // past
    parts = parts.slice(0, parts.length - 1);
  }

  if (parts.length % 2 !== 0 && text !== 'now') {
    return {
      status: 'error',
      info: 'Invalid time string. Dangling unit or number.'
    };
  }

  const pairs = [];

  while (parts.length) {
    pairs.push([parts.shift(), parts.shift()]);
  }

  let seconds = 0;

  for (const [num, interval] of pairs) {
    const val = Number(num);

    if (!Number.isInteger(val)) {
      return {
        status: 'error',
        info: `'${num}' is not an integer.`
      };
    }

    switch (interval) {
      case 'yr':
      case 'yrs':
      case 'year':
      case 'years':
        seconds += val * 31536000; // 365 * 24 * 60 * 60

        break;

      case 'wk':
      case 'wks':
      case 'week':
      case 'weeks':
        seconds += val * 604800; // 7 * 24 * 60 * 60

        break;

      case 'd':
      case 'day':
      case 'days':
        seconds += val * 86400; // 24 * 60 * 60

        break;

      case 'hr':
      case 'hrs':
      case 'hour':
      case 'hours':
        seconds += val * 3600; // 60 * 60

        break;

      case 'min':
      case 'mins':
      case 'minute':
      case 'minutes':
        seconds += val * 60;
        break;

      case 'sec':
      case 'secs':
      case 'second':
      case 'seconds':
        seconds += val;
        break;

      default:
        return {
          status: 'error',
          info: `Invalid interval: '${interval}'`
        };
    }
  }

  const milliseconds = seconds * 1000;

  if (future) {
    return {
      status: 'success',
      info: 'future',
      result: new Date(now.valueOf() + milliseconds)
    };
  } else if (past) {
    return {
      status: 'success',
      info: 'past',
      result: new Date(now.valueOf() - milliseconds)
    };
  } else {
    return {
      status: 'success',
      info: 'present',
      result: new Date(now.valueOf())
    };
  }
} // Transforms a query constraint from REST API format to Mongo format.
// A constraint is something with fields like $lt.
// If it is not a valid constraint but it could be a valid something
// else, return CannotTransform.
// inArray is whether this is an array field.


function transformConstraint(constraint, field, count = false) {
  const inArray = field && field.type && field.type === 'Array';

  if (typeof constraint !== 'object' || !constraint) {
    return CannotTransform;
  }

  const transformFunction = inArray ? transformInteriorAtom : transformTopLevelAtom;

  const transformer = atom => {
    const result = transformFunction(atom, field);

    if (result === CannotTransform) {
      throw new Parse.Error(Parse.Error.INVALID_JSON, `bad atom: ${JSON.stringify(atom)}`);
    }

    return result;
  }; // keys is the constraints in reverse alphabetical order.
  // This is a hack so that:
  //   $regex is handled before $options
  //   $nearSphere is handled before $maxDistance


  var keys = Object.keys(constraint).sort().reverse();
  var answer = {};

  for (var key of keys) {
    switch (key) {
      case '$lt':
      case '$lte':
      case '$gt':
      case '$gte':
      case '$exists':
      case '$ne':
      case '$eq':
        {
          const val = constraint[key];

          if (val && typeof val === 'object' && val.$relativeTime) {
            if (field && field.type !== 'Date') {
              throw new Parse.Error(Parse.Error.INVALID_JSON, '$relativeTime can only be used with Date field');
            }

            switch (key) {
              case '$exists':
              case '$ne':
              case '$eq':
                throw new Parse.Error(Parse.Error.INVALID_JSON, '$relativeTime can only be used with the $lt, $lte, $gt, and $gte operators');
            }

            const parserResult = relativeTimeToDate(val.$relativeTime);

            if (parserResult.status === 'success') {
              answer[key] = parserResult.result;
              break;
            }

            _logger.default.info('Error while parsing relative date', parserResult);

            throw new Parse.Error(Parse.Error.INVALID_JSON, `bad $relativeTime (${key}) value. ${parserResult.info}`);
          }

          answer[key] = transformer(val);
          break;
        }

      case '$in':
      case '$nin':
        {
          const arr = constraint[key];

          if (!(arr instanceof Array)) {
            throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad ' + key + ' value');
          }

          answer[key] = _lodash.default.flatMap(arr, value => {
            return (atom => {
              if (Array.isArray(atom)) {
                return value.map(transformer);
              } else {
                return transformer(atom);
              }
            })(value);
          });
          break;
        }

      case '$all':
        {
          const arr = constraint[key];

          if (!(arr instanceof Array)) {
            throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad ' + key + ' value');
          }

          answer[key] = arr.map(transformInteriorAtom);
          const values = answer[key];

          if (isAnyValueRegex(values) && !isAllValuesRegexOrNone(values)) {
            throw new Parse.Error(Parse.Error.INVALID_JSON, 'All $all values must be of regex type or none: ' + values);
          }

          break;
        }

      case '$regex':
        var s = constraint[key];

        if (typeof s !== 'string') {
          throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad regex: ' + s);
        }

        answer[key] = s;
        break;

      case '$containedBy':
        {
          const arr = constraint[key];

          if (!(arr instanceof Array)) {
            throw new Parse.Error(Parse.Error.INVALID_JSON, `bad $containedBy: should be an array`);
          }

          answer.$elemMatch = {
            $nin: arr.map(transformer)
          };
          break;
        }

      case '$options':
        answer[key] = constraint[key];
        break;

      case '$text':
        {
          const search = constraint[key].$search;

          if (typeof search !== 'object') {
            throw new Parse.Error(Parse.Error.INVALID_JSON, `bad $text: $search, should be object`);
          }

          if (!search.$term || typeof search.$term !== 'string') {
            throw new Parse.Error(Parse.Error.INVALID_JSON, `bad $text: $term, should be string`);
          } else {
            answer[key] = {
              $search: search.$term
            };
          }

          if (search.$language && typeof search.$language !== 'string') {
            throw new Parse.Error(Parse.Error.INVALID_JSON, `bad $text: $language, should be string`);
          } else if (search.$language) {
            answer[key].$language = search.$language;
          }

          if (search.$caseSensitive && typeof search.$caseSensitive !== 'boolean') {
            throw new Parse.Error(Parse.Error.INVALID_JSON, `bad $text: $caseSensitive, should be boolean`);
          } else if (search.$caseSensitive) {
            answer[key].$caseSensitive = search.$caseSensitive;
          }

          if (search.$diacriticSensitive && typeof search.$diacriticSensitive !== 'boolean') {
            throw new Parse.Error(Parse.Error.INVALID_JSON, `bad $text: $diacriticSensitive, should be boolean`);
          } else if (search.$diacriticSensitive) {
            answer[key].$diacriticSensitive = search.$diacriticSensitive;
          }

          break;
        }

      case '$nearSphere':
        {
          const point = constraint[key];

          if (count) {
            answer.$geoWithin = {
              $centerSphere: [[point.longitude, point.latitude], constraint.$maxDistance]
            };
          } else {
            answer[key] = [point.longitude, point.latitude];
          }

          break;
        }

      case '$maxDistance':
        {
          if (count) {
            break;
          }

          answer[key] = constraint[key];
          break;
        }
      // The SDKs don't seem to use these but they are documented in the
      // REST API docs.

      case '$maxDistanceInRadians':
        answer['$maxDistance'] = constraint[key];
        break;

      case '$maxDistanceInMiles':
        answer['$maxDistance'] = constraint[key] / 3959;
        break;

      case '$maxDistanceInKilometers':
        answer['$maxDistance'] = constraint[key] / 6371;
        break;

      case '$select':
      case '$dontSelect':
        throw new Parse.Error(Parse.Error.COMMAND_UNAVAILABLE, 'the ' + key + ' constraint is not supported yet');

      case '$within':
        var box = constraint[key]['$box'];

        if (!box || box.length != 2) {
          throw new Parse.Error(Parse.Error.INVALID_JSON, 'malformatted $within arg');
        }

        answer[key] = {
          $box: [[box[0].longitude, box[0].latitude], [box[1].longitude, box[1].latitude]]
        };
        break;

      case '$geoWithin':
        {
          const polygon = constraint[key]['$polygon'];
          const centerSphere = constraint[key]['$centerSphere'];

          if (polygon !== undefined) {
            let points;

            if (typeof polygon === 'object' && polygon.__type === 'Polygon') {
              if (!polygon.coordinates || polygon.coordinates.length < 3) {
                throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad $geoWithin value; Polygon.coordinates should contain at least 3 lon/lat pairs');
              }

              points = polygon.coordinates;
            } else if (polygon instanceof Array) {
              if (polygon.length < 3) {
                throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad $geoWithin value; $polygon should contain at least 3 GeoPoints');
              }

              points = polygon;
            } else {
              throw new Parse.Error(Parse.Error.INVALID_JSON, "bad $geoWithin value; $polygon should be Polygon object or Array of Parse.GeoPoint's");
            }

            points = points.map(point => {
              if (point instanceof Array && point.length === 2) {
                Parse.GeoPoint._validate(point[1], point[0]);

                return point;
              }

              if (!GeoPointCoder.isValidJSON(point)) {
                throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad $geoWithin value');
              } else {
                Parse.GeoPoint._validate(point.latitude, point.longitude);
              }

              return [point.longitude, point.latitude];
            });
            answer[key] = {
              $polygon: points
            };
          } else if (centerSphere !== undefined) {
            if (!(centerSphere instanceof Array) || centerSphere.length < 2) {
              throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad $geoWithin value; $centerSphere should be an array of Parse.GeoPoint and distance');
            } // Get point, convert to geo point if necessary and validate


            let point = centerSphere[0];

            if (point instanceof Array && point.length === 2) {
              point = new Parse.GeoPoint(point[1], point[0]);
            } else if (!GeoPointCoder.isValidJSON(point)) {
              throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad $geoWithin value; $centerSphere geo point invalid');
            }

            Parse.GeoPoint._validate(point.latitude, point.longitude); // Get distance and validate


            const distance = centerSphere[1];

            if (isNaN(distance) || distance < 0) {
              throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad $geoWithin value; $centerSphere distance invalid');
            }

            answer[key] = {
              $centerSphere: [[point.longitude, point.latitude], distance]
            };
          }

          break;
        }

      case '$geoIntersects':
        {
          const point = constraint[key]['$point'];

          if (!GeoPointCoder.isValidJSON(point)) {
            throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad $geoIntersect value; $point should be GeoPoint');
          } else {
            Parse.GeoPoint._validate(point.latitude, point.longitude);
          }

          answer[key] = {
            $geometry: {
              type: 'Point',
              coordinates: [point.longitude, point.latitude]
            }
          };
          break;
        }

      default:
        if (key.match(/^\$+/)) {
          throw new Parse.Error(Parse.Error.INVALID_JSON, 'bad constraint: ' + key);
        }

        return CannotTransform;
    }
  }

  return answer;
} // Transforms an update operator from REST format to mongo format.
// To be transformed, the input should have an __op field.
// If flatten is true, this will flatten operators to their static
// data format. For example, an increment of 2 would simply become a
// 2.
// The output for a non-flattened operator is a hash with __op being
// the mongo op, and arg being the argument.
// The output for a flattened operator is just a value.
// Returns undefined if this should be a no-op.


function transformUpdateOperator({
  __op,
  amount,
  objects
}, flatten) {
  switch (__op) {
    case 'Delete':
      if (flatten) {
        return undefined;
      } else {
        return {
          __op: '$unset',
          arg: ''
        };
      }

    case 'Increment':
      if (typeof amount !== 'number') {
        throw new Parse.Error(Parse.Error.INVALID_JSON, 'incrementing must provide a number');
      }

      if (flatten) {
        return amount;
      } else {
        return {
          __op: '$inc',
          arg: amount
        };
      }

    case 'Add':
    case 'AddUnique':
      if (!(objects instanceof Array)) {
        throw new Parse.Error(Parse.Error.INVALID_JSON, 'objects to add must be an array');
      }

      var toAdd = objects.map(transformInteriorAtom);

      if (flatten) {
        return toAdd;
      } else {
        var mongoOp = {
          Add: '$push',
          AddUnique: '$addToSet'
        }[__op];
        return {
          __op: mongoOp,
          arg: {
            $each: toAdd
          }
        };
      }

    case 'Remove':
      if (!(objects instanceof Array)) {
        throw new Parse.Error(Parse.Error.INVALID_JSON, 'objects to remove must be an array');
      }

      var toRemove = objects.map(transformInteriorAtom);

      if (flatten) {
        return [];
      } else {
        return {
          __op: '$pullAll',
          arg: toRemove
        };
      }

    default:
      throw new Parse.Error(Parse.Error.COMMAND_UNAVAILABLE, `The ${__op} operator is not supported yet.`);
  }
}

function mapValues(object, iterator) {
  const result = {};
  Object.keys(object).forEach(key => {
    result[key] = iterator(object[key]);
  });
  return result;
}

const nestedMongoObjectToNestedParseObject = mongoObject => {
  switch (typeof mongoObject) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'undefined':
      return mongoObject;

    case 'symbol':
    case 'function':
      throw 'bad value in nestedMongoObjectToNestedParseObject';

    case 'object':
      if (mongoObject === null) {
        return null;
      }

      if (mongoObject instanceof Array) {
        return mongoObject.map(nestedMongoObjectToNestedParseObject);
      }

      if (mongoObject instanceof Date) {
        return Parse._encode(mongoObject);
      }

      if (mongoObject instanceof mongodb.Long) {
        return mongoObject.toNumber();
      }

      if (mongoObject instanceof mongodb.Double) {
        return mongoObject.value;
      }

      if (BytesCoder.isValidDatabaseObject(mongoObject)) {
        return BytesCoder.databaseToJSON(mongoObject);
      }

      if (mongoObject.hasOwnProperty('__type') && mongoObject.__type == 'Date' && mongoObject.iso instanceof Date) {
        mongoObject.iso = mongoObject.iso.toJSON();
        return mongoObject;
      }

      return mapValues(mongoObject, nestedMongoObjectToNestedParseObject);

    default:
      throw 'unknown js type';
  }
};

const transformPointerString = (schema, field, pointerString) => {
  const objData = pointerString.split('$');

  if (objData[0] !== schema.fields[field].targetClass) {
    throw 'pointer to incorrect className';
  }

  return {
    __type: 'Pointer',
    className: objData[0],
    objectId: objData[1]
  };
}; // Converts from a mongo-format object to a REST-format object.
// Does not strip out anything based on a lack of authentication.


const mongoObjectToParseObject = (className, mongoObject, schema) => {
  switch (typeof mongoObject) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'undefined':
      return mongoObject;

    case 'symbol':
    case 'function':
      throw 'bad value in mongoObjectToParseObject';

    case 'object':
      {
        if (mongoObject === null) {
          return null;
        }

        if (mongoObject instanceof Array) {
          return mongoObject.map(nestedMongoObjectToNestedParseObject);
        }

        if (mongoObject instanceof Date) {
          return Parse._encode(mongoObject);
        }

        if (mongoObject instanceof mongodb.Long) {
          return mongoObject.toNumber();
        }

        if (mongoObject instanceof mongodb.Double) {
          return mongoObject.value;
        }

        if (BytesCoder.isValidDatabaseObject(mongoObject)) {
          return BytesCoder.databaseToJSON(mongoObject);
        }

        const restObject = {};

        if (mongoObject._rperm || mongoObject._wperm) {
          restObject._rperm = mongoObject._rperm || [];
          restObject._wperm = mongoObject._wperm || [];
          delete mongoObject._rperm;
          delete mongoObject._wperm;
        }

        for (var key in mongoObject) {
          switch (key) {
            case '_id':
              restObject['objectId'] = '' + mongoObject[key];
              break;

            case '_hashed_password':
              restObject._hashed_password = mongoObject[key];
              break;

            case '_acl':
              break;

            case '_email_verify_token':
            case '_perishable_token':
            case '_perishable_token_expires_at':
            case '_password_changed_at':
            case '_tombstone':
            case '_email_verify_token_expires_at':
            case '_account_lockout_expires_at':
            case '_failed_login_count':
            case '_password_history':
              // Those keys will be deleted if needed in the DB Controller
              restObject[key] = mongoObject[key];
              break;

            case '_session_token':
              restObject['sessionToken'] = mongoObject[key];
              break;

            case 'updatedAt':
            case '_updated_at':
              restObject['updatedAt'] = Parse._encode(new Date(mongoObject[key])).iso;
              break;

            case 'createdAt':
            case '_created_at':
              restObject['createdAt'] = Parse._encode(new Date(mongoObject[key])).iso;
              break;

            case 'expiresAt':
            case '_expiresAt':
              restObject['expiresAt'] = Parse._encode(new Date(mongoObject[key]));
              break;

            case 'lastUsed':
            case '_last_used':
              restObject['lastUsed'] = Parse._encode(new Date(mongoObject[key])).iso;
              break;

            case 'timesUsed':
            case 'times_used':
              restObject['timesUsed'] = mongoObject[key];
              break;

            default:
              // Check other auth data keys
              var authDataMatch = key.match(/^_auth_data_([a-zA-Z0-9_]+)$/);

              if (authDataMatch) {
                var provider = authDataMatch[1];
                restObject['authData'] = restObject['authData'] || {};
                restObject['authData'][provider] = mongoObject[key];
                break;
              }

              if (key.indexOf('_p_') == 0) {
                var newKey = key.substring(3);

                if (!schema.fields[newKey]) {
                  _logger.default.info('transform.js', 'Found a pointer column not in the schema, dropping it.', className, newKey);

                  break;
                }

                if (schema.fields[newKey].type !== 'Pointer') {
                  _logger.default.info('transform.js', 'Found a pointer in a non-pointer column, dropping it.', className, key);

                  break;
                }

                if (mongoObject[key] === null) {
                  break;
                }

                restObject[newKey] = transformPointerString(schema, newKey, mongoObject[key]);
                break;
              } else if (key[0] == '_' && key != '__type') {
                throw 'bad key in untransform: ' + key;
              } else {
                var value = mongoObject[key];

                if (schema.fields[key] && schema.fields[key].type === 'File' && FileCoder.isValidDatabaseObject(value)) {
                  restObject[key] = FileCoder.databaseToJSON(value);
                  break;
                }

                if (schema.fields[key] && schema.fields[key].type === 'GeoPoint' && GeoPointCoder.isValidDatabaseObject(value)) {
                  restObject[key] = GeoPointCoder.databaseToJSON(value);
                  break;
                }

                if (schema.fields[key] && schema.fields[key].type === 'Polygon' && PolygonCoder.isValidDatabaseObject(value)) {
                  restObject[key] = PolygonCoder.databaseToJSON(value);
                  break;
                }

                if (schema.fields[key] && schema.fields[key].type === 'Bytes' && BytesCoder.isValidDatabaseObject(value)) {
                  restObject[key] = BytesCoder.databaseToJSON(value);
                  break;
                }
              }

              restObject[key] = nestedMongoObjectToNestedParseObject(mongoObject[key]);
          }
        }

        const relationFieldNames = Object.keys(schema.fields).filter(fieldName => schema.fields[fieldName].type === 'Relation');
        const relationFields = {};
        relationFieldNames.forEach(relationFieldName => {
          relationFields[relationFieldName] = {
            __type: 'Relation',
            className: schema.fields[relationFieldName].targetClass
          };
        });
        return _objectSpread({}, restObject, relationFields);
      }

    default:
      throw 'unknown js type';
  }
};

var DateCoder = {
  JSONToDatabase(json) {
    return new Date(json.iso);
  },

  isValidJSON(value) {
    return typeof value === 'object' && value !== null && value.__type === 'Date';
  }

};
var BytesCoder = {
  base64Pattern: new RegExp('^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'),

  isBase64Value(object) {
    if (typeof object !== 'string') {
      return false;
    }

    return this.base64Pattern.test(object);
  },

  databaseToJSON(object) {
    let value;

    if (this.isBase64Value(object)) {
      value = object;
    } else {
      value = object.buffer.toString('base64');
    }

    return {
      __type: 'Bytes',
      base64: value
    };
  },

  isValidDatabaseObject(object) {
    return object instanceof mongodb.Binary || this.isBase64Value(object);
  },

  JSONToDatabase(json) {
    return new mongodb.Binary(new Buffer(json.base64, 'base64'));
  },

  isValidJSON(value) {
    return typeof value === 'object' && value !== null && value.__type === 'Bytes';
  }

};
var GeoPointCoder = {
  databaseToJSON(object) {
    return {
      __type: 'GeoPoint',
      latitude: object[1],
      longitude: object[0]
    };
  },

  isValidDatabaseObject(object) {
    return object instanceof Array && object.length == 2;
  },

  JSONToDatabase(json) {
    return [json.longitude, json.latitude];
  },

  isValidJSON(value) {
    return typeof value === 'object' && value !== null && value.__type === 'GeoPoint';
  }

};
var PolygonCoder = {
  databaseToJSON(object) {
    // Convert lng/lat -> lat/lng
    const coords = object.coordinates[0].map(coord => {
      return [coord[1], coord[0]];
    });
    return {
      __type: 'Polygon',
      coordinates: coords
    };
  },

  isValidDatabaseObject(object) {
    const coords = object.coordinates[0];

    if (object.type !== 'Polygon' || !(coords instanceof Array)) {
      return false;
    }

    for (let i = 0; i < coords.length; i++) {
      const point = coords[i];

      if (!GeoPointCoder.isValidDatabaseObject(point)) {
        return false;
      }

      Parse.GeoPoint._validate(parseFloat(point[1]), parseFloat(point[0]));
    }

    return true;
  },

  JSONToDatabase(json) {
    let coords = json.coordinates; // Add first point to the end to close polygon

    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    const unique = coords.filter((item, index, ar) => {
      let foundIndex = -1;

      for (let i = 0; i < ar.length; i += 1) {
        const pt = ar[i];

        if (pt[0] === item[0] && pt[1] === item[1]) {
          foundIndex = i;
          break;
        }
      }

      return foundIndex === index;
    });

    if (unique.length < 3) {
      throw new Parse.Error(Parse.Error.INTERNAL_SERVER_ERROR, 'GeoJSON: Loop must have at least 3 different vertices');
    } // Convert lat/long -> long/lat


    coords = coords.map(coord => {
      return [coord[1], coord[0]];
    });
    return {
      type: 'Polygon',
      coordinates: [coords]
    };
  },

  isValidJSON(value) {
    return typeof value === 'object' && value !== null && value.__type === 'Polygon';
  }

};
var FileCoder = {
  databaseToJSON(object) {
    return {
      __type: 'File',
      name: object
    };
  },

  isValidDatabaseObject(object) {
    return typeof object === 'string';
  },

  JSONToDatabase(json) {
    return json.name;
  },

  isValidJSON(value) {
    return typeof value === 'object' && value !== null && value.__type === 'File';
  }

};
module.exports = {
  transformKey,
  parseObjectToMongoObjectForCreate,
  transformUpdate,
  transformWhere,
  mongoObjectToParseObject,
  relativeTimeToDate,
  transformConstraint,
  transformPointerString
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9BZGFwdGVycy9TdG9yYWdlL01vbmdvL01vbmdvVHJhbnNmb3JtLmpzIl0sIm5hbWVzIjpbIm1vbmdvZGIiLCJyZXF1aXJlIiwiUGFyc2UiLCJ0cmFuc2Zvcm1LZXkiLCJjbGFzc05hbWUiLCJmaWVsZE5hbWUiLCJzY2hlbWEiLCJmaWVsZHMiLCJfX3R5cGUiLCJ0eXBlIiwidHJhbnNmb3JtS2V5VmFsdWVGb3JVcGRhdGUiLCJyZXN0S2V5IiwicmVzdFZhbHVlIiwicGFyc2VGb3JtYXRTY2hlbWEiLCJrZXkiLCJ0aW1lRmllbGQiLCJ2YWx1ZSIsInBhcnNlSW50IiwidHJhbnNmb3JtVG9wTGV2ZWxBdG9tIiwiQ2Fubm90VHJhbnNmb3JtIiwiRGF0ZSIsImluZGV4T2YiLCJBcnJheSIsIm1hcCIsInRyYW5zZm9ybUludGVyaW9yVmFsdWUiLCJ0cmFuc2Zvcm1VcGRhdGVPcGVyYXRvciIsIm1hcFZhbHVlcyIsImlzUmVnZXgiLCJSZWdFeHAiLCJpc1N0YXJ0c1dpdGhSZWdleCIsIm1hdGNoZXMiLCJ0b1N0cmluZyIsIm1hdGNoIiwiaXNBbGxWYWx1ZXNSZWdleE9yTm9uZSIsInZhbHVlcyIsImlzQXJyYXkiLCJsZW5ndGgiLCJmaXJzdFZhbHVlc0lzUmVnZXgiLCJpIiwiaXNBbnlWYWx1ZVJlZ2V4Iiwic29tZSIsIk9iamVjdCIsImtleXMiLCJpbmNsdWRlcyIsIkVycm9yIiwiSU5WQUxJRF9ORVNURURfS0VZIiwidHJhbnNmb3JtSW50ZXJpb3JBdG9tIiwidmFsdWVBc0RhdGUiLCJ0cmFuc2Zvcm1RdWVyeUtleVZhbHVlIiwiY291bnQiLCJzdWJRdWVyeSIsInRyYW5zZm9ybVdoZXJlIiwiYXV0aERhdGFNYXRjaCIsInByb3ZpZGVyIiwiZXhwZWN0ZWRUeXBlSXNBcnJheSIsImV4cGVjdGVkVHlwZUlzUG9pbnRlciIsImZpZWxkIiwidHJhbnNmb3JtZWRDb25zdHJhaW50IiwidHJhbnNmb3JtQ29uc3RyYWludCIsIiR0ZXh0IiwiJGVsZW1NYXRjaCIsIiRhbGwiLCJJTlZBTElEX0pTT04iLCJyZXN0V2hlcmUiLCJtb25nb1doZXJlIiwib3V0IiwicGFyc2VPYmplY3RLZXlWYWx1ZVRvTW9uZ29PYmplY3RLZXlWYWx1ZSIsInRyYW5zZm9ybWVkVmFsdWUiLCJjb2VyY2VkVG9EYXRlIiwiSU5WQUxJRF9LRVlfTkFNRSIsInBhcnNlT2JqZWN0VG9Nb25nb09iamVjdEZvckNyZWF0ZSIsInJlc3RDcmVhdGUiLCJhZGRMZWdhY3lBQ0wiLCJtb25nb0NyZWF0ZSIsInVuZGVmaW5lZCIsImNyZWF0ZWRBdCIsIl9jcmVhdGVkX2F0IiwiaXNvIiwidXBkYXRlZEF0IiwiX3VwZGF0ZWRfYXQiLCJ0cmFuc2Zvcm1VcGRhdGUiLCJyZXN0VXBkYXRlIiwibW9uZ29VcGRhdGUiLCJhY2wiLCJfcnBlcm0iLCJfd3Blcm0iLCJfYWNsIiwiJHNldCIsIl9fb3AiLCJhcmciLCJyZXN0T2JqZWN0IiwicmVzdE9iamVjdENvcHkiLCJmb3JFYWNoIiwiZW50cnkiLCJ3IiwiciIsImF0b20iLCJvYmplY3RJZCIsIkRhdGVDb2RlciIsImlzVmFsaWRKU09OIiwiSlNPTlRvRGF0YWJhc2UiLCJCeXRlc0NvZGVyIiwiJHJlZ2V4IiwidGFyZ2V0Q2xhc3MiLCJHZW9Qb2ludENvZGVyIiwiUG9seWdvbkNvZGVyIiwiRmlsZUNvZGVyIiwiSU5URVJOQUxfU0VSVkVSX0VSUk9SIiwicmVsYXRpdmVUaW1lVG9EYXRlIiwidGV4dCIsIm5vdyIsInRvTG93ZXJDYXNlIiwicGFydHMiLCJzcGxpdCIsImZpbHRlciIsInBhcnQiLCJmdXR1cmUiLCJwYXN0Iiwic3RhdHVzIiwiaW5mbyIsInNsaWNlIiwicGFpcnMiLCJwdXNoIiwic2hpZnQiLCJzZWNvbmRzIiwibnVtIiwiaW50ZXJ2YWwiLCJ2YWwiLCJOdW1iZXIiLCJpc0ludGVnZXIiLCJtaWxsaXNlY29uZHMiLCJyZXN1bHQiLCJ2YWx1ZU9mIiwiY29uc3RyYWludCIsImluQXJyYXkiLCJ0cmFuc2Zvcm1GdW5jdGlvbiIsInRyYW5zZm9ybWVyIiwiSlNPTiIsInN0cmluZ2lmeSIsInNvcnQiLCJyZXZlcnNlIiwiYW5zd2VyIiwiJHJlbGF0aXZlVGltZSIsInBhcnNlclJlc3VsdCIsImxvZyIsImFyciIsIl8iLCJmbGF0TWFwIiwicyIsIiRuaW4iLCJzZWFyY2giLCIkc2VhcmNoIiwiJHRlcm0iLCIkbGFuZ3VhZ2UiLCIkY2FzZVNlbnNpdGl2ZSIsIiRkaWFjcml0aWNTZW5zaXRpdmUiLCJwb2ludCIsIiRnZW9XaXRoaW4iLCIkY2VudGVyU3BoZXJlIiwibG9uZ2l0dWRlIiwibGF0aXR1ZGUiLCIkbWF4RGlzdGFuY2UiLCJDT01NQU5EX1VOQVZBSUxBQkxFIiwiYm94IiwiJGJveCIsInBvbHlnb24iLCJjZW50ZXJTcGhlcmUiLCJwb2ludHMiLCJjb29yZGluYXRlcyIsIkdlb1BvaW50IiwiX3ZhbGlkYXRlIiwiJHBvbHlnb24iLCJkaXN0YW5jZSIsImlzTmFOIiwiJGdlb21ldHJ5IiwiYW1vdW50Iiwib2JqZWN0cyIsImZsYXR0ZW4iLCJ0b0FkZCIsIm1vbmdvT3AiLCJBZGQiLCJBZGRVbmlxdWUiLCIkZWFjaCIsInRvUmVtb3ZlIiwib2JqZWN0IiwiaXRlcmF0b3IiLCJuZXN0ZWRNb25nb09iamVjdFRvTmVzdGVkUGFyc2VPYmplY3QiLCJtb25nb09iamVjdCIsIl9lbmNvZGUiLCJMb25nIiwidG9OdW1iZXIiLCJEb3VibGUiLCJpc1ZhbGlkRGF0YWJhc2VPYmplY3QiLCJkYXRhYmFzZVRvSlNPTiIsImhhc093blByb3BlcnR5IiwidG9KU09OIiwidHJhbnNmb3JtUG9pbnRlclN0cmluZyIsInBvaW50ZXJTdHJpbmciLCJvYmpEYXRhIiwibW9uZ29PYmplY3RUb1BhcnNlT2JqZWN0IiwiX2hhc2hlZF9wYXNzd29yZCIsIm5ld0tleSIsInN1YnN0cmluZyIsInJlbGF0aW9uRmllbGROYW1lcyIsInJlbGF0aW9uRmllbGRzIiwicmVsYXRpb25GaWVsZE5hbWUiLCJqc29uIiwiYmFzZTY0UGF0dGVybiIsImlzQmFzZTY0VmFsdWUiLCJ0ZXN0IiwiYnVmZmVyIiwiYmFzZTY0IiwiQmluYXJ5IiwiQnVmZmVyIiwiY29vcmRzIiwiY29vcmQiLCJwYXJzZUZsb2F0IiwidW5pcXVlIiwiaXRlbSIsImluZGV4IiwiYXIiLCJmb3VuZEluZGV4IiwicHQiLCJuYW1lIiwibW9kdWxlIiwiZXhwb3J0cyJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7QUFDQTs7Ozs7Ozs7QUFDQSxJQUFJQSxPQUFPLEdBQUdDLE9BQU8sQ0FBQyxTQUFELENBQXJCOztBQUNBLElBQUlDLEtBQUssR0FBR0QsT0FBTyxDQUFDLFlBQUQsQ0FBUCxDQUFzQkMsS0FBbEM7O0FBRUEsTUFBTUMsWUFBWSxHQUFHLENBQUNDLFNBQUQsRUFBWUMsU0FBWixFQUF1QkMsTUFBdkIsS0FBa0M7QUFDckQ7QUFDQSxVQUFRRCxTQUFSO0FBQ0UsU0FBSyxVQUFMO0FBQ0UsYUFBTyxLQUFQOztBQUNGLFNBQUssV0FBTDtBQUNFLGFBQU8sYUFBUDs7QUFDRixTQUFLLFdBQUw7QUFDRSxhQUFPLGFBQVA7O0FBQ0YsU0FBSyxjQUFMO0FBQ0UsYUFBTyxnQkFBUDs7QUFDRixTQUFLLFVBQUw7QUFDRSxhQUFPLFlBQVA7O0FBQ0YsU0FBSyxXQUFMO0FBQ0UsYUFBTyxZQUFQO0FBWko7O0FBZUEsTUFDRUMsTUFBTSxDQUFDQyxNQUFQLENBQWNGLFNBQWQsS0FDQUMsTUFBTSxDQUFDQyxNQUFQLENBQWNGLFNBQWQsRUFBeUJHLE1BQXpCLElBQW1DLFNBRnJDLEVBR0U7QUFDQUgsSUFBQUEsU0FBUyxHQUFHLFFBQVFBLFNBQXBCO0FBQ0QsR0FMRCxNQUtPLElBQ0xDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjRixTQUFkLEtBQ0FDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjRixTQUFkLEVBQXlCSSxJQUF6QixJQUFpQyxTQUY1QixFQUdMO0FBQ0FKLElBQUFBLFNBQVMsR0FBRyxRQUFRQSxTQUFwQjtBQUNEOztBQUVELFNBQU9BLFNBQVA7QUFDRCxDQTlCRDs7QUFnQ0EsTUFBTUssMEJBQTBCLEdBQUcsQ0FD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O0FBQWhDLEtBQVA7QUFDRCxHQTFEZ0I7O0FBNERqQm5ILEVBQUFBLFdBQVcsQ0FBQ25GLEtBQUQsRUFBUTtBQUNqQixXQUNFLE9BQU9BLEtBQVAsS0FBaUIsUUFBakIsSUFBNkJBLEtBQUssS0FBSyxJQUF2QyxJQUErQ0EsS0FBSyxDQUFDUixNQUFOLEtBQWlCLFNBRGxFO0FBR0Q7O0FBaEVnQixDQUFuQjtBQW1FQSxJQUFJa0csU0FBUyxHQUFHO0FBQ2R1RixFQUFBQSxjQUFjLENBQUNULE1BQUQsRUFBUztBQUNyQixXQUFPO0FBQ0xoTCxNQUFBQSxNQUFNLEVBQUUsTUFESDtBQUVMdU4sTUFBQUEsSUFBSSxFQUFFdkM7QUFGRCxLQUFQO0FBSUQsR0FOYTs7QUFRZFEsRUFBQUEscUJBQXFCLENBQUNSLE1BQUQsRUFBUztBQUM1QixXQUFPLE9BQU9BLE1BQVAsS0FBa0IsUUFBekI7QUFDRCxHQVZhOztBQVlkcEYsRUFBQUEsY0FBYyxDQUFDMEcsSUFBRCxFQUFPO0FBQ25CLFdBQU9BLElBQUksQ0FBQ2lCLElBQVo7QUFDRCxHQWRhOztBQWdCZDVILEVBQUFBLFdBQVcsQ0FBQ25GLEtBQUQsRUFBUTtBQUNqQixXQUNFLE9BQU9BLEtBQVAsS0FBaUIsUUFBakIsSUFBNkJBLEtBQUssS0FBSyxJQUF2QyxJQUErQ0EsS0FBSyxDQUFDUixNQUFOLEtBQWlCLE1BRGxFO0FBR0Q7O0FBcEJhLENBQWhCO0FBdUJBd04sTUFBTSxDQUFDQyxPQUFQLEdBQWlCO0FBQ2Y5TixFQUFBQSxZQURlO0FBRWZtRSxFQUFBQSxpQ0FGZTtBQUdmVSxFQUFBQSxlQUhlO0FBSWY3QixFQUFBQSxjQUplO0FBS2ZvSixFQUFBQSx3QkFMZTtBQU1mM0YsRUFBQUEsa0JBTmU7QUFPZmxELEVBQUFBLG1CQVBlO0FBUWYwSSxFQUFBQTtBQVJlLENBQWpCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGxvZyBmcm9tICcuLi8uLi8uLi9sb2dnZXInO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbnZhciBtb25nb2RiID0gcmVxdWlyZSgnbW9uZ29kYicpO1xudmFyIFBhcnNlID0gcmVxdWlyZSgncGFyc2Uvbm9kZScpLlBhcnNlO1xuXG5jb25zdCB0cmFuc2Zvcm1LZXkgPSAoY2xhc3NOYW1lLCBmaWVsZE5hbWUsIHNjaGVtYSkgPT4ge1xuICAvLyBDaGVjayBpZiB0aGUgc2NoZW1hIGlzIGtub3duIHNpbmNlIGl0J3MgYSBidWlsdC1pbiBmaWVsZC5cbiAgc3dpdGNoIChmaWVsZE5hbWUpIHtcbiAgICBjYXNlICdvYmplY3RJZCc6XG4gICAgICByZXR1cm4gJ19pZCc7XG4gICAgY2FzZSAnY3JlYXRlZEF0JzpcbiAgICAgIHJldHVybiAnX2NyZWF0ZWRfYXQnO1xuICAgIGNhc2UgJ3VwZGF0ZWRBdCc6XG4gICAgICByZXR1cm4gJ191cGRhdGVkX2F0JztcbiAgICBjYXNlICdzZXNzaW9uVG9rZW4nOlxuICAgICAgcmV0dXJuICdfc2Vzc2lvbl90b2tlbic7XG4gICAgY2FzZSAnbGFzdFVzZWQnOlxuICAgICAgcmV0dXJuICdfbGFzdF91c2VkJztcbiAgICBjYXNlICd0aW1lc1VzZWQnOlxuICAgICAgcmV0dXJuICd0aW1lc191c2VkJztcbiAgfVxuXG4gIGlmIChcbiAgICBzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0gJiZcbiAgICBzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0uX190eXBlID09ICdQb2ludGVyJ1xuICApIHtcbiAgICBmaWVsZE5hbWUgPSAnX3BfJyArIGZpZWxkTmFtZTtcbiAgfSBlbHNlIGlmIChcbiAgICBzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0gJiZcbiAgICBzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0udHlwZSA9PSAnUG9pbnRlcidcbiAgKSB7XG4gICAgZmllbGROYW1lID0gJ19wXycgKyBmaWVsZE5hbWU7XG4gIH1cblxuICByZXR1cm4gZmllbGROYW1lO1xufTtcblxuY29uc3QgdHJhbnNmb3JtS2V5VmFsdWVGb3JVcGRhdGUgPSAoXG4gIGNsYXNzTmFtZSxcbiAgcmVzdEtleSxcbiAgcmVzdFZhbHVlLFxuICBwYXJzZUZvcm1hdFNjaGVtYVxuKSA9PiB7XG4gIC8vIENoZWNrIGlmIHRoZSBzY2hlbWEgaXMga25vd24gc2luY2UgaXQncyBhIGJ1aWx0LWluIGZpZWxkLlxuICB2YXIga2V5ID0gcmVzdEtleTtcbiAgdmFyIHRpbWVGaWVsZCA9IGZhbHNlO1xuICBzd2l0Y2ggKGtleSkge1xuICAgIGNhc2UgJ29iamVjdElkJzpcbiAgICBjYXNlICdfaWQnOlxuICAgICAgaWYgKGNsYXNzTmFtZSA9PT0gJ19HbG9iYWxDb25maWcnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgdmFsdWU6IHBhcnNlSW50KHJlc3RWYWx1ZSksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBrZXkgPSAnX2lkJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2NyZWF0ZWRBdCc6XG4gICAgY2FzZSAnX2NyZWF0ZWRfYXQnOlxuICAgICAga2V5ID0gJ19jcmVhdGVkX2F0JztcbiAgICAgIHRpbWVGaWVsZCA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1cGRhdGVkQXQnOlxuICAgIGNhc2UgJ191cGRhdGVkX2F0JzpcbiAgICAgIGtleSA9ICdfdXBkYXRlZF9hdCc7XG4gICAgICB0aW1lRmllbGQgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnc2Vzc2lvblRva2VuJzpcbiAgICBjYXNlICdfc2Vzc2lvbl90b2tlbic6XG4gICAgICBrZXkgPSAnX3Nlc3Npb25fdG9rZW4nO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZXhwaXJlc0F0JzpcbiAgICBjYXNlICdfZXhwaXJlc0F0JzpcbiAgICAgIGtleSA9ICdleHBpcmVzQXQnO1xuICAgICAgdGltZUZpZWxkID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ19lbWFpbF92ZXJpZnlfdG9rZW5fZXhwaXJlc19hdCc6XG4gICAgICBrZXkgPSAnX2VtYWlsX3ZlcmlmeV90b2tlbl9leHBpcmVzX2F0JztcbiAgICAgIHRpbWVGaWVsZCA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdfYWNjb3VudF9sb2Nrb3V0X2V4cGlyZXNfYXQnOlxuICAgICAga2V5ID0gJ19hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdCc7XG4gICAgICB0aW1lRmllbGQgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnX2ZhaWxlZF9sb2dpbl9jb3VudCc6XG4gICAgICBrZXkgPSAnX2ZhaWxlZF9sb2dpbl9jb3VudCc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdfcGVyaXNoYWJsZV90b2tlbl9leHBpcmVzX2F0JzpcbiAgICAgIGtleSA9ICdfcGVyaXNoYWJsZV90b2tlbl9leHBpcmVzX2F0JztcbiAgICAgIHRpbWVGaWVsZCA9IHRydWU7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdfcGFzc3dvcmRfY2hhbmdlZF9hdCc6XG4gICAgICBrZXkgPSAnX3Bhc3N3b3JkX2NoYW5nZWRfYXQnO1xuICAgICAgdGltZUZpZWxkID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ19ycGVybSc6XG4gICAgY2FzZSAnX3dwZXJtJzpcbiAgICAgIHJldHVybiB7IGtleToga2V5LCB2YWx1ZTogcmVzdFZhbHVlIH07XG4gICAgY2FzZSAnbGFzdFVzZWQnOlxuICAgIGNhc2UgJ19sYXN0X3VzZWQnOlxuICAgICAga2V5ID0gJ19sYXN0X3VzZWQnO1xuICAgICAgdGltZUZpZWxkID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3RpbWVzVXNlZCc6XG4gICAgY2FzZSAndGltZXNfdXNlZCc6XG4gICAgICBrZXkgPSAndGltZXNfdXNlZCc7XG4gICAgICB0aW1lRmllbGQgPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gIH1cblxuICBpZiAoXG4gICAgKHBhcnNlRm9ybWF0U2NoZW1hLmZpZWxkc1trZXldICYmXG4gICAgICBwYXJzZUZvcm1hdFNjaGVtYS5maWVsZHNba2V5XS50eXBlID09PSAnUG9pbnRlcicpIHx8XG4gICAgKCFwYXJzZUZvcm1hdFNjaGVtYS5maWVsZHNba2V5XSAmJlxuICAgICAgcmVzdFZhbHVlICYmXG4gICAgICByZXN0VmFsdWUuX190eXBlID09ICdQb2ludGVyJylcbiAgKSB7XG4gICAga2V5ID0gJ19wXycgKyBrZXk7XG4gIH1cblxuICAvLyBIYW5kbGUgYXRvbWljIHZhbHVlc1xuICB2YXIgdmFsdWUgPSB0cmFuc2Zvcm1Ub3BMZXZlbEF0b20ocmVzdFZhbHVlKTtcbiAgaWYgKHZhbHVlICE9PSBDYW5ub3RUcmFuc2Zvcm0pIHtcbiAgICBpZiAodGltZUZpZWxkICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHZhbHVlID0gbmV3IERhdGUodmFsdWUpO1xuICAgIH1cbiAgICBpZiAocmVzdEtleS5pbmRleE9mKCcuJykgPiAwKSB7XG4gICAgICByZXR1cm4geyBrZXksIHZhbHVlOiByZXN0VmFsdWUgfTtcbiAgICB9XG4gICAgcmV0dXJuIHsga2V5LCB2YWx1ZSB9O1xuICB9XG5cbiAgLy8gSGFuZGxlIGFycmF5c1xuICBpZiAocmVzdFZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICB2YWx1ZSA9IHJlc3RWYWx1ZS5tYXAodHJhbnNmb3JtSW50ZXJpb3JWYWx1ZSk7XG4gICAgcmV0dXJuIHsga2V5LCB2YWx1ZSB9O1xuICB9XG5cbiAgLy8gSGFuZGxlIHVwZGF0ZSBvcGVyYXRvcnNcbiAgaWYgKHR5cGVvZiByZXN0VmFsdWUgPT09ICdvYmplY3QnICYmICdfX29wJyBpbiByZXN0VmFsdWUpIHtcbiAgICByZXR1cm4geyBrZXksIHZhbHVlOiB0cmFuc2Zvcm1VcGRhdGVPcGVyYXRvcihyZXN0VmFsdWUsIGZhbHNlKSB9O1xuICB9XG5cbiAgLy8gSGFuZGxlIG5vcm1hbCBvYmplY3RzIGJ5IHJlY3Vyc2luZ1xuICB2YWx1ZSA9IG1hcFZhbHVlcyhyZXN0VmFsdWUsIHRyYW5zZm9ybUludGVyaW9yVmFsdWUpO1xuICByZXR1cm4geyBrZXksIHZhbHVlIH07XG59O1xuXG5jb25zdCBpc1JlZ2V4ID0gdmFsdWUgPT4ge1xuICByZXR1cm4gdmFsdWUgJiYgdmFsdWUgaW5zdGFuY2VvZiBSZWdFeHA7XG59O1xuXG5jb25zdCBpc1N0YXJ0c1dpdGhSZWdleCA9IHZhbHVlID0+IHtcbiAgaWYgKCFpc1JlZ2V4KHZhbHVlKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IG1hdGNoZXMgPSB2YWx1ZS50b1N0cmluZygpLm1hdGNoKC9cXC9cXF5cXFxcUS4qXFxcXEVcXC8vKTtcbiAgcmV0dXJuICEhbWF0Y2hlcztcbn07XG5cbmNvbnN0IGlzQWxsVmFsdWVzUmVnZXhPck5vbmUgPSB2YWx1ZXMgPT4ge1xuICBpZiAoIXZhbHVlcyB8fCAhQXJyYXkuaXNBcnJheSh2YWx1ZXMpIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IGZpcnN0VmFsdWVzSXNSZWdleCA9IGlzU3RhcnRzV2l0aFJlZ2V4KHZhbHVlc1swXSk7XG4gIGlmICh2YWx1ZXMubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGZpcnN0VmFsdWVzSXNSZWdleDtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAxLCBsZW5ndGggPSB2YWx1ZXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoZmlyc3RWYWx1ZXNJc1JlZ2V4ICE9PSBpc1N0YXJ0c1dpdGhSZWdleCh2YWx1ZXNbaV0pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5jb25zdCBpc0FueVZhbHVlUmVnZXggPSB2YWx1ZXMgPT4ge1xuICByZXR1cm4gdmFsdWVzLnNvbWUoZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gaXNSZWdleCh2YWx1ZSk7XG4gIH0pO1xufTtcblxuY29uc3QgdHJhbnNmb3JtSW50ZXJpb3JWYWx1ZSA9IHJlc3RWYWx1ZSA9PiB7XG4gIGlmIChcbiAgICByZXN0VmFsdWUgIT09IG51bGwgJiZcbiAgICB0eXBlb2YgcmVzdFZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgIE9iamVjdC5rZXlzKHJlc3RWYWx1ZSkuc29tZShrZXkgPT4ga2V5LmluY2x1ZGVzKCckJykgfHwga2V5LmluY2x1ZGVzKCcuJykpXG4gICkge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfTkVTVEVEX0tFWSxcbiAgICAgIFwiTmVzdGVkIGtleXMgc2hvdWxkIG5vdCBjb250YWluIHRoZSAnJCcgb3IgJy4nIGNoYXJhY3RlcnNcIlxuICAgICk7XG4gIH1cbiAgLy8gSGFuZGxlIGF0b21pYyB2YWx1ZXNcbiAgdmFyIHZhbHVlID0gdHJhbnNmb3JtSW50ZXJpb3JBdG9tKHJlc3RWYWx1ZSk7XG4gIGlmICh2YWx1ZSAhPT0gQ2Fubm90VHJhbnNmb3JtKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLy8gSGFuZGxlIGFycmF5c1xuICBpZiAocmVzdFZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICByZXR1cm4gcmVzdFZhbHVlLm1hcCh0cmFuc2Zvcm1JbnRlcmlvclZhbHVlKTtcbiAgfVxuXG4gIC8vIEhhbmRsZSB1cGRhdGUgb3BlcmF0b3JzXG4gIGlmICh0eXBlb2YgcmVzdFZhbHVlID09PSAnb2JqZWN0JyAmJiAnX19vcCcgaW4gcmVzdFZhbHVlKSB7XG4gICAgcmV0dXJuIHRyYW5zZm9ybVVwZGF0ZU9wZXJhdG9yKHJlc3RWYWx1ZSwgdHJ1ZSk7XG4gIH1cblxuICAvLyBIYW5kbGUgbm9ybWFsIG9iamVjdHMgYnkgcmVjdXJzaW5nXG4gIHJldHVybiBtYXBWYWx1ZXMocmVzdFZhbHVlLCB0cmFuc2Zvcm1JbnRlcmlvclZhbHVlKTtcbn07XG5cbmNvbnN0IHZhbHVlQXNEYXRlID0gdmFsdWUgPT4ge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBuZXcgRGF0ZSh2YWx1ZSk7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybVF1ZXJ5S2V5VmFsdWUoY2xhc3NOYW1lLCBrZXksIHZhbHVlLCBzY2hlbWEsIGNvdW50ID0gZmFsc2UpIHtcbiAgc3dpdGNoIChrZXkpIHtcbiAgICBjYXNlICdjcmVhdGVkQXQnOlxuICAgICAgaWYgKHZhbHVlQXNEYXRlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4geyBrZXk6ICdfY3JlYXRlZF9hdCcsIHZhbHVlOiB2YWx1ZUFzRGF0ZSh2YWx1ZSkgfTtcbiAgICAgIH1cbiAgICAgIGtleSA9ICdfY3JlYXRlZF9hdCc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1cGRhdGVkQXQnOlxuICAgICAgaWYgKHZhbHVlQXNEYXRlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4geyBrZXk6ICdfdXBkYXRlZF9hdCcsIHZhbHVlOiB2YWx1ZUFzRGF0ZSh2YWx1ZSkgfTtcbiAgICAgIH1cbiAgICAgIGtleSA9ICdfdXBkYXRlZF9hdCc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdleHBpcmVzQXQnOlxuICAgICAgaWYgKHZhbHVlQXNEYXRlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4geyBrZXk6ICdleHBpcmVzQXQnLCB2YWx1ZTogdmFsdWVBc0RhdGUodmFsdWUpIH07XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdfZW1haWxfdmVyaWZ5X3Rva2VuX2V4cGlyZXNfYXQnOlxuICAgICAgaWYgKHZhbHVlQXNEYXRlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGtleTogJ19lbWFpbF92ZXJpZnlfdG9rZW5fZXhwaXJlc19hdCcsXG4gICAgICAgICAgdmFsdWU6IHZhbHVlQXNEYXRlKHZhbHVlKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ29iamVjdElkJzoge1xuICAgICAgaWYgKGNsYXNzTmFtZSA9PT0gJ19HbG9iYWxDb25maWcnKSB7XG4gICAgICAgIHZhbHVlID0gcGFyc2VJbnQodmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHsga2V5OiAnX2lkJywgdmFsdWUgfTtcbiAgICB9XG4gICAgY2FzZSAnX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0JzpcbiAgICAgIGlmICh2YWx1ZUFzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBrZXk6ICdfYWNjb3VudF9sb2Nrb3V0X2V4cGlyZXNfYXQnLFxuICAgICAgICAgIHZhbHVlOiB2YWx1ZUFzRGF0ZSh2YWx1ZSksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdfZmFpbGVkX2xvZ2luX2NvdW50JzpcbiAgICAgIHJldHVybiB7IGtleSwgdmFsdWUgfTtcbiAgICBjYXNlICdzZXNzaW9uVG9rZW4nOlxuICAgICAgcmV0dXJuIHsga2V5OiAnX3Nlc3Npb25fdG9rZW4nLCB2YWx1ZSB9O1xuICAgIGNhc2UgJ19wZXJpc2hhYmxlX3Rva2VuX2V4cGlyZXNfYXQnOlxuICAgICAgaWYgKHZhbHVlQXNEYXRlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGtleTogJ19wZXJpc2hhYmxlX3Rva2VuX2V4cGlyZXNfYXQnLFxuICAgICAgICAgIHZhbHVlOiB2YWx1ZUFzRGF0ZSh2YWx1ZSksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdfcGFzc3dvcmRfY2hhbmdlZF9hdCc6XG4gICAgICBpZiAodmFsdWVBc0RhdGUodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB7IGtleTogJ19wYXNzd29yZF9jaGFuZ2VkX2F0JywgdmFsdWU6IHZhbHVlQXNEYXRlKHZhbHVlKSB9O1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnX3JwZXJtJzpcbiAgICBjYXNlICdfd3Blcm0nOlxuICAgIGNhc2UgJ19wZXJpc2hhYmxlX3Rva2VuJzpcbiAgICBjYXNlICdfZW1haWxfdmVyaWZ5X3Rva2VuJzpcbiAgICAgIHJldHVybiB7IGtleSwgdmFsdWUgfTtcbiAgICBjYXNlICckb3InOlxuICAgIGNhc2UgJyRhbmQnOlxuICAgIGNhc2UgJyRub3InOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHZhbHVlOiB2YWx1ZS5tYXAoc3ViUXVlcnkgPT5cbiAgICAgICAgICB0cmFuc2Zvcm1XaGVyZShjbGFzc05hbWUsIHN1YlF1ZXJ5LCBzY2hlbWEsIGNvdW50KVxuICAgICAgICApLFxuICAgICAgfTtcbiAgICBjYXNlICdsYXN0VXNlZCc6XG4gICAgICBpZiAodmFsdWVBc0RhdGUodmFsdWUpKSB7XG4gICAgICAgIHJldHVybiB7IGtleTogJ19sYXN0X3VzZWQnLCB2YWx1ZTogdmFsdWVBc0RhdGUodmFsdWUpIH07XG4gICAgICB9XG4gICAgICBrZXkgPSAnX2xhc3RfdXNlZCc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd0aW1lc1VzZWQnOlxuICAgICAgcmV0dXJuIHsga2V5OiAndGltZXNfdXNlZCcsIHZhbHVlOiB2YWx1ZSB9O1xuICAgIGRlZmF1bHQ6IHtcbiAgICAgIC8vIE90aGVyIGF1dGggZGF0YVxuICAgICAgY29uc3QgYXV0aERhdGFNYXRjaCA9IGtleS5tYXRjaCgvXmF1dGhEYXRhXFwuKFthLXpBLVowLTlfXSspXFwuaWQkLyk7XG4gICAgICBpZiAoYXV0aERhdGFNYXRjaCkge1xuICAgICAgICBjb25zdCBwcm92aWRlciA9IGF1dGhEYXRhTWF0Y2hbMV07XG4gICAgICAgIC8vIFNwZWNpYWwtY2FzZSBhdXRoIGRhdGEuXG4gICAgICAgIHJldHVybiB7IGtleTogYF9hdXRoX2RhdGFfJHtwcm92aWRlcn0uaWRgLCB2YWx1ZSB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGV4cGVjdGVkVHlwZUlzQXJyYXkgPVxuICAgIHNjaGVtYSAmJiBzY2hlbWEuZmllbGRzW2tleV0gJiYgc2NoZW1hLmZpZWxkc1trZXldLnR5cGUgPT09ICdBcnJheSc7XG5cbiAgY29uc3QgZXhwZWN0ZWRUeXBlSXNQb2ludGVyID1cbiAgICBzY2hlbWEgJiYgc2NoZW1hLmZpZWxkc1trZXldICYmIHNjaGVtYS5maWVsZHNba2V5XS50eXBlID09PSAnUG9pbnRlcic7XG5cbiAgY29uc3QgZmllbGQgPSBzY2hlbWEgJiYgc2NoZW1hLmZpZWxkc1trZXldO1xuICBpZiAoXG4gICAgZXhwZWN0ZWRUeXBlSXNQb2ludGVyIHx8XG4gICAgKCFzY2hlbWEgJiYgdmFsdWUgJiYgdmFsdWUuX190eXBlID09PSAnUG9pbnRlcicpXG4gICkge1xuICAgIGtleSA9ICdfcF8nICsga2V5O1xuICB9XG5cbiAgLy8gSGFuZGxlIHF1ZXJ5IGNvbnN0cmFpbnRzXG4gIGNvbnN0IHRyYW5zZm9ybWVkQ29uc3RyYWludCA9IHRyYW5zZm9ybUNvbnN0cmFpbnQodmFsdWUsIGZpZWxkLCBjb3VudCk7XG4gIGlmICh0cmFuc2Zvcm1lZENvbnN0cmFpbnQgIT09IENhbm5vdFRyYW5zZm9ybSkge1xuICAgIGlmICh0cmFuc2Zvcm1lZENvbnN0cmFpbnQuJHRleHQpIHtcbiAgICAgIHJldHVybiB7IGtleTogJyR0ZXh0JywgdmFsdWU6IHRyYW5zZm9ybWVkQ29uc3RyYWludC4kdGV4dCB9O1xuICAgIH1cbiAgICBpZiAodHJhbnNmb3JtZWRDb25zdHJhaW50LiRlbGVtTWF0Y2gpIHtcbiAgICAgIHJldHVybiB7IGtleTogJyRub3InLCB2YWx1ZTogW3sgW2tleV06IHRyYW5zZm9ybWVkQ29uc3RyYWludCB9XSB9O1xuICAgIH1cbiAgICByZXR1cm4geyBrZXksIHZhbHVlOiB0cmFuc2Zvcm1lZENvbnN0cmFpbnQgfTtcbiAgfVxuXG4gIGlmIChleHBlY3RlZFR5cGVJc0FycmF5ICYmICEodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICByZXR1cm4geyBrZXksIHZhbHVlOiB7ICRhbGw6IFt0cmFuc2Zvcm1JbnRlcmlvckF0b20odmFsdWUpXSB9IH07XG4gIH1cblxuICAvLyBIYW5kbGUgYXRvbWljIHZhbHVlc1xuICBpZiAodHJhbnNmb3JtVG9wTGV2ZWxBdG9tKHZhbHVlKSAhPT0gQ2Fubm90VHJhbnNmb3JtKSB7XG4gICAgcmV0dXJuIHsga2V5LCB2YWx1ZTogdHJhbnNmb3JtVG9wTGV2ZWxBdG9tKHZhbHVlKSB9O1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgIGBZb3UgY2Fubm90IHVzZSAke3ZhbHVlfSBhcyBhIHF1ZXJ5IHBhcmFtZXRlci5gXG4gICAgKTtcbiAgfVxufVxuXG4vLyBNYWluIGV4cG9zZWQgbWV0aG9kIHRvIGhlbHAgcnVuIHF1ZXJpZXMuXG4vLyByZXN0V2hlcmUgaXMgdGhlIFwid2hlcmVcIiBjbGF1c2UgaW4gUkVTVCBBUEkgZm9ybS5cbi8vIFJldHVybnMgdGhlIG1vbmdvIGZvcm0gb2YgdGhlIHF1ZXJ5LlxuZnVuY3Rpb24gdHJhbnNmb3JtV2hlcmUoY2xhc3NOYW1lLCByZXN0V2hlcmUsIHNjaGVtYSwgY291bnQgPSBmYWxzZSkge1xuICBjb25zdCBtb25nb1doZXJlID0ge307XG4gIGZvciAoY29uc3QgcmVzdEtleSBpbiByZXN0V2hlcmUpIHtcbiAgICBjb25zdCBvdXQgPSB0cmFuc2Zvcm1RdWVyeUtleVZhbHVlKFxuICAgICAgY2xhc3NOYW1lLFxuICAgICAgcmVzdEtleSxcbiAgICAgIHJlc3RXaGVyZVtyZXN0S2V5XSxcbiAgICAgIHNjaGVtYSxcbiAgICAgIGNvdW50XG4gICAgKTtcbiAgICBtb25nb1doZXJlW291dC5rZXldID0gb3V0LnZhbHVlO1xuICB9XG4gIHJldHVybiBtb25nb1doZXJlO1xufVxuXG5jb25zdCBwYXJzZU9iamVjdEtleVZhbHVlVG9Nb25nb09iamVjdEtleVZhbHVlID0gKFxuICByZXN0S2V5LFxuICByZXN0VmFsdWUsXG4gIHNjaGVtYVxuKSA9PiB7XG4gIC8vIENoZWNrIGlmIHRoZSBzY2hlbWEgaXMga25vd24gc2luY2UgaXQncyBhIGJ1aWx0LWluIGZpZWxkLlxuICBsZXQgdHJhbnNmb3JtZWRWYWx1ZTtcbiAgbGV0IGNvZXJjZWRUb0RhdGU7XG4gIHN3aXRjaCAocmVzdEtleSkge1xuICAgIGNhc2UgJ29iamVjdElkJzpcbiAgICAgIHJldHVybiB7IGtleTogJ19pZCcsIHZhbHVlOiByZXN0VmFsdWUgfTtcbiAgICBjYXNlICdleHBpcmVzQXQnOlxuICAgICAgdHJhbnNmb3JtZWRWYWx1ZSA9IHRyYW5zZm9ybVRvcExldmVsQXRvbShyZXN0VmFsdWUpO1xuICAgICAgY29lcmNlZFRvRGF0ZSA9XG4gICAgICAgIHR5cGVvZiB0cmFuc2Zvcm1lZFZhbHVlID09PSAnc3RyaW5nJ1xuICAgICAgICAgID8gbmV3IERhdGUodHJhbnNmb3JtZWRWYWx1ZSlcbiAgICAgICAgICA6IHRyYW5zZm9ybWVkVmFsdWU7XG4gICAgICByZXR1cm4geyBrZXk6ICdleHBpcmVzQXQnLCB2YWx1ZTogY29lcmNlZFRvRGF0ZSB9O1xuICAgIGNhc2UgJ19lbWFpbF92ZXJpZnlfdG9rZW5fZXhwaXJlc19hdCc6XG4gICAgICB0cmFuc2Zvcm1lZFZhbHVlID0gdHJhbnNmb3JtVG9wTGV2ZWxBdG9tKHJlc3RWYWx1ZSk7XG4gICAgICBjb2VyY2VkVG9EYXRlID1cbiAgICAgICAgdHlwZW9mIHRyYW5zZm9ybWVkVmFsdWUgPT09ICdzdHJpbmcnXG4gICAgICAgICAgPyBuZXcgRGF0ZSh0cmFuc2Zvcm1lZFZhbHVlKVxuICAgICAgICAgIDogdHJhbnNmb3JtZWRWYWx1ZTtcbiAgICAgIHJldHVybiB7IGtleTogJ19lbWFpbF92ZXJpZnlfdG9rZW5fZXhwaXJlc19hdCcsIHZhbHVlOiBjb2VyY2VkVG9EYXRlIH07XG4gICAgY2FzZSAnX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0JzpcbiAgICAgIHRyYW5zZm9ybWVkVmFsdWUgPSB0cmFuc2Zvcm1Ub3BMZXZlbEF0b20ocmVzdFZhbHVlKTtcbiAgICAgIGNvZXJjZWRUb0RhdGUgPVxuICAgICAgICB0eXBlb2YgdHJhbnNmb3JtZWRWYWx1ZSA9PT0gJ3N0cmluZydcbiAgICAgICAgICA/IG5ldyBEYXRlKHRyYW5zZm9ybWVkVmFsdWUpXG4gICAgICAgICAgOiB0cmFuc2Zvcm1lZFZhbHVlO1xuICAgICAgcmV0dXJuIHsga2V5OiAnX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0JywgdmFsdWU6IGNvZXJjZWRUb0RhdGUgfTtcbiAgICBjYXNlICdfcGVyaXNoYWJsZV90b2tlbl9leHBpcmVzX2F0JzpcbiAgICAgIHRyYW5zZm9ybWVkVmFsdWUgPSB0cmFuc2Zvcm1Ub3BMZXZlbEF0b20ocmVzdFZhbHVlKTtcbiAgICAgIGNvZXJjZWRUb0RhdGUgPVxuICAgICAgICB0eXBlb2YgdHJhbnNmb3JtZWRWYWx1ZSA9PT0gJ3N0cmluZydcbiAgICAgICAgICA/IG5ldyBEYXRlKHRyYW5zZm9ybWVkVmFsdWUpXG4gICAgICAgICAgOiB0cmFuc2Zvcm1lZFZhbHVlO1xuICAgICAgcmV0dXJuIHsga2V5OiAnX3BlcmlzaGFibGVfdG9rZW5fZXhwaXJlc19hdCcsIHZhbHVlOiBjb2VyY2VkVG9EYXRlIH07XG4gICAgY2FzZSAnX3Bhc3N3b3JkX2NoYW5nZWRfYXQnOlxuICAgICAgdHJhbnNmb3JtZWRWYWx1ZSA9IHRyYW5zZm9ybVRvcExldmVsQXRvbShyZXN0VmFsdWUpO1xuICAgICAgY29lcmNlZFRvRGF0ZSA9XG4gICAgICAgIHR5cGVvZiB0cmFuc2Zvcm1lZFZhbHVlID09PSAnc3RyaW5nJ1xuICAgICAgICAgID8gbmV3IERhdGUodHJhbnNmb3JtZWRWYWx1ZSlcbiAgICAgICAgICA6IHRyYW5zZm9ybWVkVmFsdWU7XG4gICAgICByZXR1cm4geyBrZXk6ICdfcGFzc3dvcmRfY2hhbmdlZF9hdCcsIHZhbHVlOiBjb2VyY2VkVG9EYXRlIH07XG4gICAgY2FzZSAnX2ZhaWxlZF9sb2dpbl9jb3VudCc6XG4gICAgY2FzZSAnX3JwZXJtJzpcbiAgICBjYXNlICdfd3Blcm0nOlxuICAgIGNhc2UgJ19lbWFpbF92ZXJpZnlfdG9rZW4nOlxuICAgIGNhc2UgJ19oYXNoZWRfcGFzc3dvcmQnOlxuICAgIGNhc2UgJ19wZXJpc2hhYmxlX3Rva2VuJzpcbiAgICAgIHJldHVybiB7IGtleTogcmVzdEtleSwgdmFsdWU6IHJlc3RWYWx1ZSB9O1xuICAgIGNhc2UgJ3Nlc3Npb25Ub2tlbic6XG4gICAgICByZXR1cm4geyBrZXk6ICdfc2Vzc2lvbl90b2tlbicsIHZhbHVlOiByZXN0VmFsdWUgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gQXV0aCBkYXRhIHNob3VsZCBoYXZlIGJlZW4gdHJhbnNmb3JtZWQgYWxyZWFkeVxuICAgICAgaWYgKHJlc3RLZXkubWF0Y2goL15hdXRoRGF0YVxcLihbYS16QS1aMC05X10rKVxcLmlkJC8pKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLFxuICAgICAgICAgICdjYW4gb25seSBxdWVyeSBvbiAnICsgcmVzdEtleVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgLy8gVHJ1c3QgdGhhdCB0aGUgYXV0aCBkYXRhIGhhcyBiZWVuIHRyYW5zZm9ybWVkIGFuZCBzYXZlIGl0IGRpcmVjdGx5XG4gICAgICBpZiAocmVzdEtleS5tYXRjaCgvXl9hdXRoX2RhdGFfW2EtekEtWjAtOV9dKyQvKSkge1xuICAgICAgICByZXR1cm4geyBrZXk6IHJlc3RLZXksIHZhbHVlOiByZXN0VmFsdWUgfTtcbiAgICAgIH1cbiAgfVxuICAvL3NraXAgc3RyYWlnaHQgdG8gdHJhbnNmb3JtVG9wTGV2ZWxBdG9tIGZvciBCeXRlcywgdGhleSBkb24ndCBzaG93IHVwIGluIHRoZSBzY2hlbWEgZm9yIHNvbWUgcmVhc29uXG4gIGlmIChyZXN0VmFsdWUgJiYgcmVzdFZhbHVlLl9fdHlwZSAhPT0gJ0J5dGVzJykge1xuICAgIC8vTm90ZTogV2UgbWF5IG5vdCBrbm93IHRoZSB0eXBlIG9mIGEgZmllbGQgaGVyZSwgYXMgdGhlIHVzZXIgY291bGQgYmUgc2F2aW5nIChudWxsKSB0byBhIGZpZWxkXG4gICAgLy9UaGF0IG5ldmVyIGV4aXN0ZWQgYmVmb3JlLCBtZWFuaW5nIHdlIGNhbid0IGluZmVyIHRoZSB0eXBlLlxuICAgIGlmIChcbiAgICAgIChzY2hlbWEuZmllbGRzW3Jlc3RLZXldICYmIHNjaGVtYS5maWVsZHNbcmVzdEtleV0udHlwZSA9PSAnUG9pbnRlcicpIHx8XG4gICAgICByZXN0VmFsdWUuX190eXBlID09ICdQb2ludGVyJ1xuICAgICkge1xuICAgICAgcmVzdEtleSA9ICdfcF8nICsgcmVzdEtleTtcbiAgICB9XG4gIH1cblxuICAvLyBIYW5kbGUgYXRvbWljIHZhbHVlc1xuICB2YXIgdmFsdWUgPSB0cmFuc2Zvcm1Ub3BMZXZlbEF0b20ocmVzdFZhbHVlKTtcbiAgaWYgKHZhbHVlICE9PSBDYW5ub3RUcmFuc2Zvcm0pIHtcbiAgICByZXR1cm4geyBrZXk6IHJlc3RLZXksIHZhbHVlOiB2YWx1ZSB9O1xuICB9XG5cbiAgLy8gQUNMcyBhcmUgaGFuZGxlZCBiZWZvcmUgdGhpcyBtZXRob2QgaXMgY2FsbGVkXG4gIC8vIElmIGFuIEFDTCBrZXkgc3RpbGwgZXhpc3RzIGhlcmUsIHNvbWV0aGluZyBpcyB3cm9uZy5cbiAgaWYgKHJlc3RLZXkgPT09ICdBQ0wnKSB7XG4gICAgdGhyb3cgJ1RoZXJlIHdhcyBhIHByb2JsZW0gdHJhbnNmb3JtaW5nIGFuIEFDTC4nO1xuICB9XG5cbiAgLy8gSGFuZGxlIGFycmF5c1xuICBpZiAocmVzdFZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICB2YWx1ZSA9IHJlc3RWYWx1ZS5tYXAodHJhbnNmb3JtSW50ZXJpb3JWYWx1ZSk7XG4gICAgcmV0dXJuIHsga2V5OiByZXN0S2V5LCB2YWx1ZTogdmFsdWUgfTtcbiAgfVxuXG4gIC8vIEhhbmRsZSBub3JtYWwgb2JqZWN0cyBieSByZWN1cnNpbmdcbiAgaWYgKFxuICAgIE9iamVjdC5rZXlzKHJlc3RWYWx1ZSkuc29tZShrZXkgPT4ga2V5LmluY2x1ZGVzKCckJykgfHwga2V5LmluY2x1ZGVzKCcuJykpXG4gICkge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfTkVTVEVEX0tFWSxcbiAgICAgIFwiTmVzdGVkIGtleXMgc2hvdWxkIG5vdCBjb250YWluIHRoZSAnJCcgb3IgJy4nIGNoYXJhY3RlcnNcIlxuICAgICk7XG4gIH1cbiAgdmFsdWUgPSBtYXBWYWx1ZXMocmVzdFZhbHVlLCB0cmFuc2Zvcm1JbnRlcmlvclZhbHVlKTtcbiAgcmV0dXJuIHsga2V5OiByZXN0S2V5LCB2YWx1ZSB9O1xufTtcblxuY29uc3QgcGFyc2VPYmplY3RUb01vbmdvT2JqZWN0Rm9yQ3JlYXRlID0gKGNsYXNzTmFtZSwgcmVzdENyZWF0ZSwgc2NoZW1hKSA9PiB7XG4gIHJlc3RDcmVhdGUgPSBhZGRMZWdhY3lBQ0wocmVzdENyZWF0ZSk7XG4gIGNvbnN0IG1vbmdvQ3JlYXRlID0ge307XG4gIGZvciAoY29uc3QgcmVzdEtleSBpbiByZXN0Q3JlYXRlKSB7XG4gICAgaWYgKHJlc3RDcmVhdGVbcmVzdEtleV0gJiYgcmVzdENyZWF0ZVtyZXN0S2V5XS5fX3R5cGUgPT09ICdSZWxhdGlvbicpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCB7IGtleSwgdmFsdWUgfSA9IHBhcnNlT2JqZWN0S2V5VmFsdWVUb01vbmdvT2JqZWN0S2V5VmFsdWUoXG4gICAgICByZXN0S2V5LFxuICAgICAgcmVzdENyZWF0ZVtyZXN0S2V5XSxcbiAgICAgIHNjaGVtYVxuICAgICk7XG4gICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG1vbmdvQ3JlYXRlW2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBVc2UgdGhlIGxlZ2FjeSBtb25nbyBmb3JtYXQgZm9yIGNyZWF0ZWRBdCBhbmQgdXBkYXRlZEF0XG4gIGlmIChtb25nb0NyZWF0ZS5jcmVhdGVkQXQpIHtcbiAgICBtb25nb0NyZWF0ZS5fY3JlYXRlZF9hdCA9IG5ldyBEYXRlKFxuICAgICAgbW9uZ29DcmVhdGUuY3JlYXRlZEF0LmlzbyB8fCBtb25nb0NyZWF0ZS5jcmVhdGVkQXRcbiAgICApO1xuICAgIGRlbGV0ZSBtb25nb0NyZWF0ZS5jcmVhdGVkQXQ7XG4gIH1cbiAgaWYgKG1vbmdvQ3JlYXRlLnVwZGF0ZWRBdCkge1xuICAgIG1vbmdvQ3JlYXRlLl91cGRhdGVkX2F0ID0gbmV3IERhdGUoXG4gICAgICBtb25nb0NyZWF0ZS51cGRhdGVkQXQuaXNvIHx8IG1vbmdvQ3JlYXRlLnVwZGF0ZWRBdFxuICAgICk7XG4gICAgZGVsZXRlIG1vbmdvQ3JlYXRlLnVwZGF0ZWRBdDtcbiAgfVxuXG4gIHJldHVybiBtb25nb0NyZWF0ZTtcbn07XG5cbi8vIE1haW4gZXhwb3NlZCBtZXRob2QgdG8gaGVscCB1cGRhdGUgb2xkIG9iamVjdHMuXG5jb25zdCB0cmFuc2Zvcm1VcGRhdGUgPSAoY2xhc3NOYW1lLCByZXN0VXBkYXRlLCBwYXJzZUZvcm1hdFNjaGVtYSkgPT4ge1xuICBjb25zdCBtb25nb1VwZGF0ZSA9IHt9O1xuICBjb25zdCBhY2wgPSBhZGRMZWdhY3lBQ0wocmVzdFVwZGF0ZSk7XG4gIGlmIChhY2wuX3JwZXJtIHx8IGFjbC5fd3Blcm0gfHwgYWNsLl9hY2wpIHtcbiAgICBtb25nb1VwZGF0ZS4kc2V0ID0ge307XG4gICAgaWYgKGFjbC5fcnBlcm0pIHtcbiAgICAgIG1vbmdvVXBkYXRlLiRzZXQuX3JwZXJtID0gYWNsLl9ycGVybTtcbiAgICB9XG4gICAgaWYgKGFjbC5fd3Blcm0pIHtcbiAgICAgIG1vbmdvVXBkYXRlLiRzZXQuX3dwZXJtID0gYWNsLl93cGVybTtcbiAgICB9XG4gICAgaWYgKGFjbC5fYWNsKSB7XG4gICAgICBtb25nb1VwZGF0ZS4kc2V0Ll9hY2wgPSBhY2wuX2FjbDtcbiAgICB9XG4gIH1cbiAgZm9yICh2YXIgcmVzdEtleSBpbiByZXN0VXBkYXRlKSB7XG4gICAgaWYgKHJlc3RVcGRhdGVbcmVzdEtleV0gJiYgcmVzdFVwZGF0ZVtyZXN0S2V5XS5fX3R5cGUgPT09ICdSZWxhdGlvbicpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB2YXIgb3V0ID0gdHJhbnNmb3JtS2V5VmFsdWVGb3JVcGRhdGUoXG4gICAgICBjbGFzc05hbWUsXG4gICAgICByZXN0S2V5LFxuICAgICAgcmVzdFVwZGF0ZVtyZXN0S2V5XSxcbiAgICAgIHBhcnNlRm9ybWF0U2NoZW1hXG4gICAgKTtcblxuICAgIC8vIElmIHRoZSBvdXRwdXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW55ICQga2V5cywgaXQncyBhblxuICAgIC8vIG9wZXJhdG9yIHRoYXQgbmVlZHMgdG8gYmUgbGlmdGVkIG9udG8gdGhlIHRvcCBsZXZlbCB1cGRhdGVcbiAgICAvLyBvYmplY3QuXG4gICAgaWYgKHR5cGVvZiBvdXQudmFsdWUgPT09ICdvYmplY3QnICYmIG91dC52YWx1ZSAhPT0gbnVsbCAmJiBvdXQudmFsdWUuX19vcCkge1xuICAgICAgbW9uZ29VcGRhdGVbb3V0LnZhbHVlLl9fb3BdID0gbW9uZ29VcGRhdGVbb3V0LnZhbHVlLl9fb3BdIHx8IHt9O1xuICAgICAgbW9uZ29VcGRhdGVbb3V0LnZhbHVlLl9fb3BdW291dC5rZXldID0gb3V0LnZhbHVlLmFyZztcbiAgICB9IGVsc2Uge1xuICAgICAgbW9uZ29VcGRhdGVbJyRzZXQnXSA9IG1vbmdvVXBkYXRlWyckc2V0J10gfHwge307XG4gICAgICBtb25nb1VwZGF0ZVsnJHNldCddW291dC5rZXldID0gb3V0LnZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtb25nb1VwZGF0ZTtcbn07XG5cbi8vIEFkZCB0aGUgbGVnYWN5IF9hY2wgZm9ybWF0LlxuY29uc3QgYWRkTGVnYWN5QUNMID0gcmVzdE9iamVjdCA9PiB7XG4gIGNvbnN0IHJlc3RPYmplY3RDb3B5ID0geyAuLi5yZXN0T2JqZWN0IH07XG4gIGNvbnN0IF9hY2wgPSB7fTtcblxuICBpZiAocmVzdE9iamVjdC5fd3Blcm0pIHtcbiAgICByZXN0T2JqZWN0Ll93cGVybS5mb3JFYWNoKGVudHJ5ID0+IHtcbiAgICAgIF9hY2xbZW50cnldID0geyB3OiB0cnVlIH07XG4gICAgfSk7XG4gICAgcmVzdE9iamVjdENvcHkuX2FjbCA9IF9hY2w7XG4gIH1cblxuICBpZiAocmVzdE9iamVjdC5fcnBlcm0pIHtcbiAgICByZXN0T2JqZWN0Ll9ycGVybS5mb3JFYWNoKGVudHJ5ID0+IHtcbiAgICAgIGlmICghKGVudHJ5IGluIF9hY2wpKSB7XG4gICAgICAgIF9hY2xbZW50cnldID0geyByOiB0cnVlIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfYWNsW2VudHJ5XS5yID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXN0T2JqZWN0Q29weS5fYWNsID0gX2FjbDtcbiAgfVxuXG4gIHJldHVybiByZXN0T2JqZWN0Q29weTtcbn07XG5cbi8vIEEgc2VudGluZWwgdmFsdWUgdGhhdCBoZWxwZXIgdHJhbnNmb3JtYXRpb25zIHJldHVybiB3aGVuIHRoZXlcbi8vIGNhbm5vdCBwZXJmb3JtIGEgdHJhbnNmb3JtYXRpb25cbmZ1bmN0aW9uIENhbm5vdFRyYW5zZm9ybSgpIHt9XG5cbmNvbnN0IHRyYW5zZm9ybUludGVyaW9yQXRvbSA9IGF0b20gPT4ge1xuICAvLyBUT0RPOiBjaGVjayB2YWxpZGl0eSBoYXJkZXIgZm9yIHRoZSBfX3R5cGUtZGVmaW5lZCB0eXBlc1xuICBpZiAoXG4gICAgdHlwZW9mIGF0b20gPT09ICdvYmplY3QnICYmXG4gICAgYXRvbSAmJlxuICAgICEoYXRvbSBpbnN0YW5jZW9mIERhdGUpICYmXG4gICAgYXRvbS5fX3R5cGUgPT09ICdQb2ludGVyJ1xuICApIHtcbiAgICByZXR1cm4ge1xuICAgICAgX190eXBlOiAnUG9pbnRlcicsXG4gICAgICBjbGFzc05hbWU6IGF0b20uY2xhc3NOYW1lLFxuICAgICAgb2JqZWN0SWQ6IGF0b20ub2JqZWN0SWQsXG4gICAgfTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgYXRvbSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgYXRvbSA9PT0gJ3N5bWJvbCcpIHtcbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICBgY2Fubm90IHRyYW5zZm9ybSB2YWx1ZTogJHthdG9tfWBcbiAgICApO1xuICB9IGVsc2UgaWYgKERhdGVDb2Rlci5pc1ZhbGlkSlNPTihhdG9tKSkge1xuICAgIHJldHVybiBEYXRlQ29kZXIuSlNPTlRvRGF0YWJhc2UoYXRvbSk7XG4gIH0gZWxzZSBpZiAoQnl0ZXNDb2Rlci5pc1ZhbGlkSlNPTihhdG9tKSkge1xuICAgIHJldHVybiBCeXRlc0NvZGVyLkpTT05Ub0RhdGFiYXNlKGF0b20pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBhdG9tID09PSAnb2JqZWN0JyAmJiBhdG9tICYmIGF0b20uJHJlZ2V4ICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cChhdG9tLiRyZWdleCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGF0b207XG4gIH1cbn07XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byB0cmFuc2Zvcm0gYW4gYXRvbSBmcm9tIFJFU1QgZm9ybWF0IHRvIE1vbmdvIGZvcm1hdC5cbi8vIEFuIGF0b20gaXMgYW55dGhpbmcgdGhhdCBjYW4ndCBjb250YWluIG90aGVyIGV4cHJlc3Npb25zLiBTbyBpdFxuLy8gaW5jbHVkZXMgdGhpbmdzIHdoZXJlIG9iamVjdHMgYXJlIHVzZWQgdG8gcmVwcmVzZW50IG90aGVyXG4vLyBkYXRhdHlwZXMsIGxpa2UgcG9pbnRlcnMgYW5kIGRhdGVzLCBidXQgaXQgZG9lcyBub3QgaW5jbHVkZSBvYmplY3RzXG4vLyBvciBhcnJheXMgd2l0aCBnZW5lcmljIHN0dWZmIGluc2lkZS5cbi8vIFJhaXNlcyBhbiBlcnJvciBpZiB0aGlzIGNhbm5vdCBwb3NzaWJseSBiZSB2YWxpZCBSRVNUIGZvcm1hdC5cbi8vIFJldHVybnMgQ2Fubm90VHJhbnNmb3JtIGlmIGl0J3MganVzdCBub3QgYW4gYXRvbVxuZnVuY3Rpb24gdHJhbnNmb3JtVG9wTGV2ZWxBdG9tKGF0b20sIGZpZWxkKSB7XG4gIHN3aXRjaCAodHlwZW9mIGF0b20pIHtcbiAgICBjYXNlICdudW1iZXInOlxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICByZXR1cm4gYXRvbTtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgaWYgKGZpZWxkICYmIGZpZWxkLnR5cGUgPT09ICdQb2ludGVyJykge1xuICAgICAgICByZXR1cm4gYCR7ZmllbGQudGFyZ2V0Q2xhc3N9JCR7YXRvbX1gO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGF0b207XG4gICAgY2FzZSAnc3ltYm9sJzpcbiAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgYGNhbm5vdCB0cmFuc2Zvcm0gdmFsdWU6ICR7YXRvbX1gXG4gICAgICApO1xuICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICBpZiAoYXRvbSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgLy8gVGVjaG5pY2FsbHkgZGF0ZXMgYXJlIG5vdCByZXN0IGZvcm1hdCwgYnV0LCBpdCBzZWVtcyBwcmV0dHlcbiAgICAgICAgLy8gY2xlYXIgd2hhdCB0aGV5IHNob3VsZCBiZSB0cmFuc2Zvcm1lZCB0bywgc28gbGV0J3MganVzdCBkbyBpdC5cbiAgICAgICAgcmV0dXJuIGF0b207XG4gICAgICB9XG5cbiAgICAgIGlmIChhdG9tID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBhdG9tO1xuICAgICAgfVxuXG4gICAgICAvLyBUT0RPOiBjaGVjayB2YWxpZGl0eSBoYXJkZXIgZm9yIHRoZSBfX3R5cGUtZGVmaW5lZCB0eXBlc1xuICAgICAgaWYgKGF0b20uX190eXBlID09ICdQb2ludGVyJykge1xuICAgICAgICByZXR1cm4gYCR7YXRvbS5jbGFzc05hbWV9JCR7YXRvbS5vYmplY3RJZH1gO1xuICAgICAgfVxuICAgICAgaWYgKERhdGVDb2Rlci5pc1ZhbGlkSlNPTihhdG9tKSkge1xuICAgICAgICByZXR1cm4gRGF0ZUNvZGVyLkpTT05Ub0RhdGFiYXNlKGF0b20pO1xuICAgICAgfVxuICAgICAgaWYgKEJ5dGVzQ29kZXIuaXNWYWxpZEpTT04oYXRvbSkpIHtcbiAgICAgICAgcmV0dXJuIEJ5dGVzQ29kZXIuSlNPTlRvRGF0YWJhc2UoYXRvbSk7XG4gICAgICB9XG4gICAgICBpZiAoR2VvUG9pbnRDb2Rlci5pc1ZhbGlkSlNPTihhdG9tKSkge1xuICAgICAgICByZXR1cm4gR2VvUG9pbnRDb2Rlci5KU09OVG9EYXRhYmFzZShhdG9tKTtcbiAgICAgIH1cbiAgICAgIGlmIChQb2x5Z29uQ29kZXIuaXNWYWxpZEpTT04oYXRvbSkpIHtcbiAgICAgICAgcmV0dXJuIFBvbHlnb25Db2Rlci5KU09OVG9EYXRhYmFzZShhdG9tKTtcbiAgICAgIH1cbiAgICAgIGlmIChGaWxlQ29kZXIuaXNWYWxpZEpTT04oYXRvbSkpIHtcbiAgICAgICAgcmV0dXJuIEZpbGVDb2Rlci5KU09OVG9EYXRhYmFzZShhdG9tKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBDYW5ub3RUcmFuc2Zvcm07XG5cbiAgICBkZWZhdWx0OlxuICAgICAgLy8gSSBkb24ndCB0aGluayB0eXBlb2YgY2FuIGV2ZXIgbGV0IHVzIGdldCBoZXJlXG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgIFBhcnNlLkVycm9yLklOVEVSTkFMX1NFUlZFUl9FUlJPUixcbiAgICAgICAgYHJlYWxseSBkaWQgbm90IGV4cGVjdCB2YWx1ZTogJHthdG9tfWBcbiAgICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVsYXRpdmVUaW1lVG9EYXRlKHRleHQsIG5vdyA9IG5ldyBEYXRlKCkpIHtcbiAgdGV4dCA9IHRleHQudG9Mb3dlckNhc2UoKTtcblxuICBsZXQgcGFydHMgPSB0ZXh0LnNwbGl0KCcgJyk7XG5cbiAgLy8gRmlsdGVyIG91dCB3aGl0ZXNwYWNlXG4gIHBhcnRzID0gcGFydHMuZmlsdGVyKHBhcnQgPT4gcGFydCAhPT0gJycpO1xuXG4gIGNvbnN0IGZ1dHVyZSA9IHBhcnRzWzBdID09PSAnaW4nO1xuICBjb25zdCBwYXN0ID0gcGFydHNbcGFydHMubGVuZ3RoIC0gMV0gPT09ICdhZ28nO1xuXG4gIGlmICghZnV0dXJlICYmICFwYXN0ICYmIHRleHQgIT09ICdub3cnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1czogJ2Vycm9yJyxcbiAgICAgIGluZm86IFwiVGltZSBzaG91bGQgZWl0aGVyIHN0YXJ0IHdpdGggJ2luJyBvciBlbmQgd2l0aCAnYWdvJ1wiLFxuICAgIH07XG4gIH1cblxuICBpZiAoZnV0dXJlICYmIHBhc3QpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzOiAnZXJyb3InLFxuICAgICAgaW5mbzogXCJUaW1lIGNhbm5vdCBoYXZlIGJvdGggJ2luJyBhbmQgJ2FnbydcIixcbiAgICB9O1xuICB9XG5cbiAgLy8gc3RyaXAgdGhlICdhZ28nIG9yICdpbidcbiAgaWYgKGZ1dHVyZSkge1xuICAgIHBhcnRzID0gcGFydHMuc2xpY2UoMSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gcGFzdFxuICAgIHBhcnRzID0gcGFydHMuc2xpY2UoMCwgcGFydHMubGVuZ3RoIC0gMSk7XG4gIH1cblxuICBpZiAocGFydHMubGVuZ3RoICUgMiAhPT0gMCAmJiB0ZXh0ICE9PSAnbm93Jykge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6ICdlcnJvcicsXG4gICAgICBpbmZvOiAnSW52YWxpZCB0aW1lIHN0cmluZy4gRGFuZ2xpbmcgdW5pdCBvciBudW1iZXIuJyxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcGFpcnMgPSBbXTtcbiAgd2hpbGUgKHBhcnRzLmxlbmd0aCkge1xuICAgIHBhaXJzLnB1c2goW3BhcnRzLnNoaWZ0KCksIHBhcnRzLnNoaWZ0KCldKTtcbiAgfVxuXG4gIGxldCBzZWNvbmRzID0gMDtcbiAgZm9yIChjb25zdCBbbnVtLCBpbnRlcnZhbF0gb2YgcGFpcnMpIHtcbiAgICBjb25zdCB2YWwgPSBOdW1iZXIobnVtKTtcbiAgICBpZiAoIU51bWJlci5pc0ludGVnZXIodmFsKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiAnZXJyb3InLFxuICAgICAgICBpbmZvOiBgJyR7bnVtfScgaXMgbm90IGFuIGludGVnZXIuYCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgc3dpdGNoIChpbnRlcnZhbCkge1xuICAgICAgY2FzZSAneXInOlxuICAgICAgY2FzZSAneXJzJzpcbiAgICAgIGNhc2UgJ3llYXInOlxuICAgICAgY2FzZSAneWVhcnMnOlxuICAgICAgICBzZWNvbmRzICs9IHZhbCAqIDMxNTM2MDAwOyAvLyAzNjUgKiAyNCAqIDYwICogNjBcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ3drJzpcbiAgICAgIGNhc2UgJ3drcyc6XG4gICAgICBjYXNlICd3ZWVrJzpcbiAgICAgIGNhc2UgJ3dlZWtzJzpcbiAgICAgICAgc2Vjb25kcyArPSB2YWwgKiA2MDQ4MDA7IC8vIDcgKiAyNCAqIDYwICogNjBcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ2QnOlxuICAgICAgY2FzZSAnZGF5JzpcbiAgICAgIGNhc2UgJ2RheXMnOlxuICAgICAgICBzZWNvbmRzICs9IHZhbCAqIDg2NDAwOyAvLyAyNCAqIDYwICogNjBcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ2hyJzpcbiAgICAgIGNhc2UgJ2hycyc6XG4gICAgICBjYXNlICdob3VyJzpcbiAgICAgIGNhc2UgJ2hvdXJzJzpcbiAgICAgICAgc2Vjb25kcyArPSB2YWwgKiAzNjAwOyAvLyA2MCAqIDYwXG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdtaW4nOlxuICAgICAgY2FzZSAnbWlucyc6XG4gICAgICBjYXNlICdtaW51dGUnOlxuICAgICAgY2FzZSAnbWludXRlcyc6XG4gICAgICAgIHNlY29uZHMgKz0gdmFsICogNjA7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdzZWMnOlxuICAgICAgY2FzZSAnc2Vjcyc6XG4gICAgICBjYXNlICdzZWNvbmQnOlxuICAgICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgICAgIHNlY29uZHMgKz0gdmFsO1xuICAgICAgICBicmVhaztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0dXM6ICdlcnJvcicsXG4gICAgICAgICAgaW5mbzogYEludmFsaWQgaW50ZXJ2YWw6ICcke2ludGVydmFsfSdgLFxuICAgICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IG1pbGxpc2Vjb25kcyA9IHNlY29uZHMgKiAxMDAwO1xuICBpZiAoZnV0dXJlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1czogJ3N1Y2Nlc3MnLFxuICAgICAgaW5mbzogJ2Z1dHVyZScsXG4gICAgICByZXN1bHQ6IG5ldyBEYXRlKG5vdy52YWx1ZU9mKCkgKyBtaWxsaXNlY29uZHMpLFxuICAgIH07XG4gIH0gZWxzZSBpZiAocGFzdCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6ICdzdWNjZXNzJyxcbiAgICAgIGluZm86ICdwYXN0JyxcbiAgICAgIHJlc3VsdDogbmV3IERhdGUobm93LnZhbHVlT2YoKSAtIG1pbGxpc2Vjb25kcyksXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzOiAnc3VjY2VzcycsXG4gICAgICBpbmZvOiAncHJlc2VudCcsXG4gICAgICByZXN1bHQ6IG5ldyBEYXRlKG5vdy52YWx1ZU9mKCkpLFxuICAgIH07XG4gIH1cbn1cblxuLy8gVHJhbnNmb3JtcyBhIHF1ZXJ5IGNvbnN0cmFpbnQgZnJvbSBSRVNUIEFQSSBmb3JtYXQgdG8gTW9uZ28gZm9ybWF0LlxuLy8gQSBjb25zdHJhaW50IGlzIHNvbWV0aGluZyB3aXRoIGZpZWxkcyBsaWtlICRsdC5cbi8vIElmIGl0IGlzIG5vdCBhIHZhbGlkIGNvbnN0cmFpbnQgYnV0IGl0IGNvdWxkIGJlIGEgdmFsaWQgc29tZXRoaW5nXG4vLyBlbHNlLCByZXR1cm4gQ2Fubm90VHJhbnNmb3JtLlxuLy8gaW5BcnJheSBpcyB3aGV0aGVyIHRoaXMgaXMgYW4gYXJyYXkgZmllbGQuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Db25zdHJhaW50KGNvbnN0cmFpbnQsIGZpZWxkLCBjb3VudCA9IGZhbHNlKSB7XG4gIGNvbnN0IGluQXJyYXkgPSBmaWVsZCAmJiBmaWVsZC50eXBlICYmIGZpZWxkLnR5cGUgPT09ICdBcnJheSc7XG4gIGlmICh0eXBlb2YgY29uc3RyYWludCAhPT0gJ29iamVjdCcgfHwgIWNvbnN0cmFpbnQpIHtcbiAgICByZXR1cm4gQ2Fubm90VHJhbnNmb3JtO1xuICB9XG4gIGNvbnN0IHRyYW5zZm9ybUZ1bmN0aW9uID0gaW5BcnJheVxuICAgID8gdHJhbnNmb3JtSW50ZXJpb3JBdG9tXG4gICAgOiB0cmFuc2Zvcm1Ub3BMZXZlbEF0b207XG4gIGNvbnN0IHRyYW5zZm9ybWVyID0gYXRvbSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gdHJhbnNmb3JtRnVuY3Rpb24oYXRvbSwgZmllbGQpO1xuICAgIGlmIChyZXN1bHQgPT09IENhbm5vdFRyYW5zZm9ybSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgIGBiYWQgYXRvbTogJHtKU09OLnN0cmluZ2lmeShhdG9tKX1gXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICAvLyBrZXlzIGlzIHRoZSBjb25zdHJhaW50cyBpbiByZXZlcnNlIGFscGhhYmV0aWNhbCBvcmRlci5cbiAgLy8gVGhpcyBpcyBhIGhhY2sgc28gdGhhdDpcbiAgLy8gICAkcmVnZXggaXMgaGFuZGxlZCBiZWZvcmUgJG9wdGlvbnNcbiAgLy8gICAkbmVhclNwaGVyZSBpcyBoYW5kbGVkIGJlZm9yZSAkbWF4RGlzdGFuY2VcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhjb25zdHJhaW50KVxuICAgIC5zb3J0KClcbiAgICAucmV2ZXJzZSgpO1xuICB2YXIgYW5zd2VyID0ge307XG4gIGZvciAodmFyIGtleSBvZiBrZXlzKSB7XG4gICAgc3dpdGNoIChrZXkpIHtcbiAgICAgIGNhc2UgJyRsdCc6XG4gICAgICBjYXNlICckbHRlJzpcbiAgICAgIGNhc2UgJyRndCc6XG4gICAgICBjYXNlICckZ3RlJzpcbiAgICAgIGNhc2UgJyRleGlzdHMnOlxuICAgICAgY2FzZSAnJG5lJzpcbiAgICAgIGNhc2UgJyRlcSc6IHtcbiAgICAgICAgY29uc3QgdmFsID0gY29uc3RyYWludFtrZXldO1xuICAgICAgICBpZiAodmFsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnICYmIHZhbC4kcmVsYXRpdmVUaW1lKSB7XG4gICAgICAgICAgaWYgKGZpZWxkICYmIGZpZWxkLnR5cGUgIT09ICdEYXRlJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICAgICckcmVsYXRpdmVUaW1lIGNhbiBvbmx5IGJlIHVzZWQgd2l0aCBEYXRlIGZpZWxkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICAgICAgY2FzZSAnJGV4aXN0cyc6XG4gICAgICAgICAgICBjYXNlICckbmUnOlxuICAgICAgICAgICAgY2FzZSAnJGVxJzpcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgICAgICAgICAnJHJlbGF0aXZlVGltZSBjYW4gb25seSBiZSB1c2VkIHdpdGggdGhlICRsdCwgJGx0ZSwgJGd0LCBhbmQgJGd0ZSBvcGVyYXRvcnMnXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFyc2VyUmVzdWx0ID0gcmVsYXRpdmVUaW1lVG9EYXRlKHZhbC4kcmVsYXRpdmVUaW1lKTtcbiAgICAgICAgICBpZiAocGFyc2VyUmVzdWx0LnN0YXR1cyA9PT0gJ3N1Y2Nlc3MnKSB7XG4gICAgICAgICAgICBhbnN3ZXJba2V5XSA9IHBhcnNlclJlc3VsdC5yZXN1bHQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsb2cuaW5mbygnRXJyb3Igd2hpbGUgcGFyc2luZyByZWxhdGl2ZSBkYXRlJywgcGFyc2VyUmVzdWx0KTtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICBgYmFkICRyZWxhdGl2ZVRpbWUgKCR7a2V5fSkgdmFsdWUuICR7cGFyc2VyUmVzdWx0LmluZm99YFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBhbnN3ZXJba2V5XSA9IHRyYW5zZm9ybWVyKHZhbCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlICckaW4nOlxuICAgICAgY2FzZSAnJG5pbic6IHtcbiAgICAgICAgY29uc3QgYXJyID0gY29uc3RyYWludFtrZXldO1xuICAgICAgICBpZiAoIShhcnIgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICAnYmFkICcgKyBrZXkgKyAnIHZhbHVlJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgYW5zd2VyW2tleV0gPSBfLmZsYXRNYXAoYXJyLCB2YWx1ZSA9PiB7XG4gICAgICAgICAgcmV0dXJuIChhdG9tID0+IHtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGF0b20pKSB7XG4gICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5tYXAodHJhbnNmb3JtZXIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRyYW5zZm9ybWVyKGF0b20pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pKHZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnJGFsbCc6IHtcbiAgICAgICAgY29uc3QgYXJyID0gY29uc3RyYWludFtrZXldO1xuICAgICAgICBpZiAoIShhcnIgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICAnYmFkICcgKyBrZXkgKyAnIHZhbHVlJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgYW5zd2VyW2tleV0gPSBhcnIubWFwKHRyYW5zZm9ybUludGVyaW9yQXRvbSk7XG5cbiAgICAgICAgY29uc3QgdmFsdWVzID0gYW5zd2VyW2tleV07XG4gICAgICAgIGlmIChpc0FueVZhbHVlUmVnZXgodmFsdWVzKSAmJiAhaXNBbGxWYWx1ZXNSZWdleE9yTm9uZSh2YWx1ZXMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICAgJ0FsbCAkYWxsIHZhbHVlcyBtdXN0IGJlIG9mIHJlZ2V4IHR5cGUgb3Igbm9uZTogJyArIHZhbHVlc1xuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJyRyZWdleCc6XG4gICAgICAgIHZhciBzID0gY29uc3RyYWludFtrZXldO1xuICAgICAgICBpZiAodHlwZW9mIHMgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgJ2JhZCByZWdleDogJyArIHMpO1xuICAgICAgICB9XG4gICAgICAgIGFuc3dlcltrZXldID0gcztcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJyRjb250YWluZWRCeSc6IHtcbiAgICAgICAgY29uc3QgYXJyID0gY29uc3RyYWludFtrZXldO1xuICAgICAgICBpZiAoIShhcnIgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICBgYmFkICRjb250YWluZWRCeTogc2hvdWxkIGJlIGFuIGFycmF5YFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgYW5zd2VyLiRlbGVtTWF0Y2ggPSB7XG4gICAgICAgICAgJG5pbjogYXJyLm1hcCh0cmFuc2Zvcm1lciksXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnJG9wdGlvbnMnOlxuICAgICAgICBhbnN3ZXJba2V5XSA9IGNvbnN0cmFpbnRba2V5XTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJyR0ZXh0Jzoge1xuICAgICAgICBjb25zdCBzZWFyY2ggPSBjb25zdHJhaW50W2tleV0uJHNlYXJjaDtcbiAgICAgICAgaWYgKHR5cGVvZiBzZWFyY2ggIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICAgYGJhZCAkdGV4dDogJHNlYXJjaCwgc2hvdWxkIGJlIG9iamVjdGBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmICghc2VhcmNoLiR0ZXJtIHx8IHR5cGVvZiBzZWFyY2guJHRlcm0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICAgYGJhZCAkdGV4dDogJHRlcm0sIHNob3VsZCBiZSBzdHJpbmdgXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhbnN3ZXJba2V5XSA9IHtcbiAgICAgICAgICAgICRzZWFyY2g6IHNlYXJjaC4kdGVybSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZWFyY2guJGxhbmd1YWdlICYmIHR5cGVvZiBzZWFyY2guJGxhbmd1YWdlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgICAgIGBiYWQgJHRleHQ6ICRsYW5ndWFnZSwgc2hvdWxkIGJlIHN0cmluZ2BcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKHNlYXJjaC4kbGFuZ3VhZ2UpIHtcbiAgICAgICAgICBhbnN3ZXJba2V5XS4kbGFuZ3VhZ2UgPSBzZWFyY2guJGxhbmd1YWdlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICBzZWFyY2guJGNhc2VTZW5zaXRpdmUgJiZcbiAgICAgICAgICB0eXBlb2Ygc2VhcmNoLiRjYXNlU2Vuc2l0aXZlICE9PSAnYm9vbGVhbidcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICAgYGJhZCAkdGV4dDogJGNhc2VTZW5zaXRpdmUsIHNob3VsZCBiZSBib29sZWFuYFxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAoc2VhcmNoLiRjYXNlU2Vuc2l0aXZlKSB7XG4gICAgICAgICAgYW5zd2VyW2tleV0uJGNhc2VTZW5zaXRpdmUgPSBzZWFyY2guJGNhc2VTZW5zaXRpdmU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgIHNlYXJjaC4kZGlhY3JpdGljU2Vuc2l0aXZlICYmXG4gICAgICAgICAgdHlwZW9mIHNlYXJjaC4kZGlhY3JpdGljU2Vuc2l0aXZlICE9PSAnYm9vbGVhbidcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICAgYGJhZCAkdGV4dDogJGRpYWNyaXRpY1NlbnNpdGl2ZSwgc2hvdWxkIGJlIGJvb2xlYW5gXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChzZWFyY2guJGRpYWNyaXRpY1NlbnNpdGl2ZSkge1xuICAgICAgICAgIGFuc3dlcltrZXldLiRkaWFjcml0aWNTZW5zaXRpdmUgPSBzZWFyY2guJGRpYWNyaXRpY1NlbnNpdGl2ZTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJyRuZWFyU3BoZXJlJzoge1xuICAgICAgICBjb25zdCBwb2ludCA9IGNvbnN0cmFpbnRba2V5XTtcbiAgICAgICAgaWYgKGNvdW50KSB7XG4gICAgICAgICAgYW5zd2VyLiRnZW9XaXRoaW4gPSB7XG4gICAgICAgICAgICAkY2VudGVyU3BoZXJlOiBbXG4gICAgICAgICAgICAgIFtwb2ludC5sb25naXR1ZGUsIHBvaW50LmxhdGl0dWRlXSxcbiAgICAgICAgICAgICAgY29uc3RyYWludC4kbWF4RGlzdGFuY2UsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYW5zd2VyW2tleV0gPSBbcG9pbnQubG9uZ2l0dWRlLCBwb2ludC5sYXRpdHVkZV07XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICckbWF4RGlzdGFuY2UnOiB7XG4gICAgICAgIGlmIChjb3VudCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGFuc3dlcltrZXldID0gY29uc3RyYWludFtrZXldO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIFRoZSBTREtzIGRvbid0IHNlZW0gdG8gdXNlIHRoZXNlIGJ1dCB0aGV5IGFyZSBkb2N1bWVudGVkIGluIHRoZVxuICAgICAgLy8gUkVTVCBBUEkgZG9jcy5cbiAgICAgIGNhc2UgJyRtYXhEaXN0YW5jZUluUmFkaWFucyc6XG4gICAgICAgIGFuc3dlclsnJG1heERpc3RhbmNlJ10gPSBjb25zdHJhaW50W2tleV07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnJG1heERpc3RhbmNlSW5NaWxlcyc6XG4gICAgICAgIGFuc3dlclsnJG1heERpc3RhbmNlJ10gPSBjb25zdHJhaW50W2tleV0gLyAzOTU5O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJyRtYXhEaXN0YW5jZUluS2lsb21ldGVycyc6XG4gICAgICAgIGFuc3dlclsnJG1heERpc3RhbmNlJ10gPSBjb25zdHJhaW50W2tleV0gLyA2MzcxO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnJHNlbGVjdCc6XG4gICAgICBjYXNlICckZG9udFNlbGVjdCc6XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICBQYXJzZS5FcnJvci5DT01NQU5EX1VOQVZBSUxBQkxFLFxuICAgICAgICAgICd0aGUgJyArIGtleSArICcgY29uc3RyYWludCBpcyBub3Qgc3VwcG9ydGVkIHlldCdcbiAgICAgICAgKTtcblxuICAgICAgY2FzZSAnJHdpdGhpbic6XG4gICAgICAgIHZhciBib3ggPSBjb25zdHJhaW50W2tleV1bJyRib3gnXTtcbiAgICAgICAgaWYgKCFib3ggfHwgYm94Lmxlbmd0aCAhPSAyKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICAgJ21hbGZvcm1hdHRlZCAkd2l0aGluIGFyZydcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGFuc3dlcltrZXldID0ge1xuICAgICAgICAgICRib3g6IFtcbiAgICAgICAgICAgIFtib3hbMF0ubG9uZ2l0dWRlLCBib3hbMF0ubGF0aXR1ZGVdLFxuICAgICAgICAgICAgW2JveFsxXS5sb25naXR1ZGUsIGJveFsxXS5sYXRpdHVkZV0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJyRnZW9XaXRoaW4nOiB7XG4gICAgICAgIGNvbnN0IHBvbHlnb24gPSBjb25zdHJhaW50W2tleV1bJyRwb2x5Z29uJ107XG4gICAgICAgIGNvbnN0IGNlbnRlclNwaGVyZSA9IGNvbnN0cmFpbnRba2V5XVsnJGNlbnRlclNwaGVyZSddO1xuICAgICAgICBpZiAocG9seWdvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgbGV0IHBvaW50cztcbiAgICAgICAgICBpZiAodHlwZW9mIHBvbHlnb24gPT09ICdvYmplY3QnICYmIHBvbHlnb24uX190eXBlID09PSAnUG9seWdvbicpIHtcbiAgICAgICAgICAgIGlmICghcG9seWdvbi5jb29yZGluYXRlcyB8fCBwb2x5Z29uLmNvb3JkaW5hdGVzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgICAgICAgICAnYmFkICRnZW9XaXRoaW4gdmFsdWU7IFBvbHlnb24uY29vcmRpbmF0ZXMgc2hvdWxkIGNvbnRhaW4gYXQgbGVhc3QgMyBsb24vbGF0IHBhaXJzJ1xuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcG9pbnRzID0gcG9seWdvbi5jb29yZGluYXRlcztcbiAgICAgICAgICB9IGVsc2UgaWYgKHBvbHlnb24gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgICAgaWYgKHBvbHlnb24ubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICAgICAgICdiYWQgJGdlb1dpdGhpbiB2YWx1ZTsgJHBvbHlnb24gc2hvdWxkIGNvbnRhaW4gYXQgbGVhc3QgMyBHZW9Qb2ludHMnXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwb2ludHMgPSBwb2x5Z29uO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgICAgICAgXCJiYWQgJGdlb1dpdGhpbiB2YWx1ZTsgJHBvbHlnb24gc2hvdWxkIGJlIFBvbHlnb24gb2JqZWN0IG9yIEFycmF5IG9mIFBhcnNlLkdlb1BvaW50J3NcIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcG9pbnRzID0gcG9pbnRzLm1hcChwb2ludCA9PiB7XG4gICAgICAgICAgICBpZiAocG9pbnQgaW5zdGFuY2VvZiBBcnJheSAmJiBwb2ludC5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAgICAgUGFyc2UuR2VvUG9pbnQuX3ZhbGlkYXRlKHBvaW50WzFdLCBwb2ludFswXSk7XG4gICAgICAgICAgICAgIHJldHVybiBwb2ludDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghR2VvUG9pbnRDb2Rlci5pc1ZhbGlkSlNPTihwb2ludCkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgICAgICAgICAnYmFkICRnZW9XaXRoaW4gdmFsdWUnXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBQYXJzZS5HZW9Qb2ludC5fdmFsaWRhdGUocG9pbnQubGF0aXR1ZGUsIHBvaW50LmxvbmdpdHVkZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gW3BvaW50LmxvbmdpdHVkZSwgcG9pbnQubGF0aXR1ZGVdO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGFuc3dlcltrZXldID0ge1xuICAgICAgICAgICAgJHBvbHlnb246IHBvaW50cyxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKGNlbnRlclNwaGVyZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaWYgKCEoY2VudGVyU3BoZXJlIGluc3RhbmNlb2YgQXJyYXkpIHx8IGNlbnRlclNwaGVyZS5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgICAgICAgJ2JhZCAkZ2VvV2l0aGluIHZhbHVlOyAkY2VudGVyU3BoZXJlIHNob3VsZCBiZSBhbiBhcnJheSBvZiBQYXJzZS5HZW9Qb2ludCBhbmQgZGlzdGFuY2UnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBHZXQgcG9pbnQsIGNvbnZlcnQgdG8gZ2VvIHBvaW50IGlmIG5lY2Vzc2FyeSBhbmQgdmFsaWRhdGVcbiAgICAgICAgICBsZXQgcG9pbnQgPSBjZW50ZXJTcGhlcmVbMF07XG4gICAgICAgICAgaWYgKHBvaW50IGluc3RhbmNlb2YgQXJyYXkgJiYgcG9pbnQubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICBwb2ludCA9IG5ldyBQYXJzZS5HZW9Qb2ludChwb2ludFsxXSwgcG9pbnRbMF0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIUdlb1BvaW50Q29kZXIuaXNWYWxpZEpTT04ocG9pbnQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgIFBhcnNlLkVycm9yLklOVkFMSURfSlNPTixcbiAgICAgICAgICAgICAgJ2JhZCAkZ2VvV2l0aGluIHZhbHVlOyAkY2VudGVyU3BoZXJlIGdlbyBwb2ludCBpbnZhbGlkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgUGFyc2UuR2VvUG9pbnQuX3ZhbGlkYXRlKHBvaW50LmxhdGl0dWRlLCBwb2ludC5sb25naXR1ZGUpO1xuICAgICAgICAgIC8vIEdldCBkaXN0YW5jZSBhbmQgdmFsaWRhdGVcbiAgICAgICAgICBjb25zdCBkaXN0YW5jZSA9IGNlbnRlclNwaGVyZVsxXTtcbiAgICAgICAgICBpZiAoaXNOYU4oZGlzdGFuY2UpIHx8IGRpc3RhbmNlIDwgMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICAgICdiYWQgJGdlb1dpdGhpbiB2YWx1ZTsgJGNlbnRlclNwaGVyZSBkaXN0YW5jZSBpbnZhbGlkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYW5zd2VyW2tleV0gPSB7XG4gICAgICAgICAgICAkY2VudGVyU3BoZXJlOiBbW3BvaW50LmxvbmdpdHVkZSwgcG9pbnQubGF0aXR1ZGVdLCBkaXN0YW5jZV0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJyRnZW9JbnRlcnNlY3RzJzoge1xuICAgICAgICBjb25zdCBwb2ludCA9IGNvbnN0cmFpbnRba2V5XVsnJHBvaW50J107XG4gICAgICAgIGlmICghR2VvUG9pbnRDb2Rlci5pc1ZhbGlkSlNPTihwb2ludCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICAnYmFkICRnZW9JbnRlcnNlY3QgdmFsdWU7ICRwb2ludCBzaG91bGQgYmUgR2VvUG9pbnQnXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBQYXJzZS5HZW9Qb2ludC5fdmFsaWRhdGUocG9pbnQubGF0aXR1ZGUsIHBvaW50LmxvbmdpdHVkZSk7XG4gICAgICAgIH1cbiAgICAgICAgYW5zd2VyW2tleV0gPSB7XG4gICAgICAgICAgJGdlb21ldHJ5OiB7XG4gICAgICAgICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgICAgICAgY29vcmRpbmF0ZXM6IFtwb2ludC5sb25naXR1ZGUsIHBvaW50LmxhdGl0dWRlXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChrZXkubWF0Y2goL15cXCQrLykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgICAnYmFkIGNvbnN0cmFpbnQ6ICcgKyBrZXlcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDYW5ub3RUcmFuc2Zvcm07XG4gICAgfVxuICB9XG4gIHJldHVybiBhbnN3ZXI7XG59XG5cbi8vIFRyYW5zZm9ybXMgYW4gdXBkYXRlIG9wZXJhdG9yIGZyb20gUkVTVCBmb3JtYXQgdG8gbW9uZ28gZm9ybWF0LlxuLy8gVG8gYmUgdHJhbnNmb3JtZWQsIHRoZSBpbnB1dCBzaG91bGQgaGF2ZSBhbiBfX29wIGZpZWxkLlxuLy8gSWYgZmxhdHRlbiBpcyB0cnVlLCB0aGlzIHdpbGwgZmxhdHRlbiBvcGVyYXRvcnMgdG8gdGhlaXIgc3RhdGljXG4vLyBkYXRhIGZvcm1hdC4gRm9yIGV4YW1wbGUsIGFuIGluY3JlbWVudCBvZiAyIHdvdWxkIHNpbXBseSBiZWNvbWUgYVxuLy8gMi5cbi8vIFRoZSBvdXRwdXQgZm9yIGEgbm9uLWZsYXR0ZW5lZCBvcGVyYXRvciBpcyBhIGhhc2ggd2l0aCBfX29wIGJlaW5nXG4vLyB0aGUgbW9uZ28gb3AsIGFuZCBhcmcgYmVpbmcgdGhlIGFyZ3VtZW50LlxuLy8gVGhlIG91dHB1dCBmb3IgYSBmbGF0dGVuZWQgb3BlcmF0b3IgaXMganVzdCBhIHZhbHVlLlxuLy8gUmV0dXJucyB1bmRlZmluZWQgaWYgdGhpcyBzaG91bGQgYmUgYSBuby1vcC5cblxuZnVuY3Rpb24gdHJhbnNmb3JtVXBkYXRlT3BlcmF0b3IoeyBfX29wLCBhbW91bnQsIG9iamVjdHMgfSwgZmxhdHRlbikge1xuICBzd2l0Y2ggKF9fb3ApIHtcbiAgICBjYXNlICdEZWxldGUnOlxuICAgICAgaWYgKGZsYXR0ZW4pIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7IF9fb3A6ICckdW5zZXQnLCBhcmc6ICcnIH07XG4gICAgICB9XG5cbiAgICBjYXNlICdJbmNyZW1lbnQnOlxuICAgICAgaWYgKHR5cGVvZiBhbW91bnQgIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgJ2luY3JlbWVudGluZyBtdXN0IHByb3ZpZGUgYSBudW1iZXInXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoZmxhdHRlbikge1xuICAgICAgICByZXR1cm4gYW1vdW50O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHsgX19vcDogJyRpbmMnLCBhcmc6IGFtb3VudCB9O1xuICAgICAgfVxuXG4gICAgY2FzZSAnQWRkJzpcbiAgICBjYXNlICdBZGRVbmlxdWUnOlxuICAgICAgaWYgKCEob2JqZWN0cyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLFxuICAgICAgICAgICdvYmplY3RzIHRvIGFkZCBtdXN0IGJlIGFuIGFycmF5J1xuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdmFyIHRvQWRkID0gb2JqZWN0cy5tYXAodHJhbnNmb3JtSW50ZXJpb3JBdG9tKTtcbiAgICAgIGlmIChmbGF0dGVuKSB7XG4gICAgICAgIHJldHVybiB0b0FkZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBtb25nb09wID0ge1xuICAgICAgICAgIEFkZDogJyRwdXNoJyxcbiAgICAgICAgICBBZGRVbmlxdWU6ICckYWRkVG9TZXQnLFxuICAgICAgICB9W19fb3BdO1xuICAgICAgICByZXR1cm4geyBfX29wOiBtb25nb09wLCBhcmc6IHsgJGVhY2g6IHRvQWRkIH0gfTtcbiAgICAgIH1cblxuICAgIGNhc2UgJ1JlbW92ZSc6XG4gICAgICBpZiAoIShvYmplY3RzIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sXG4gICAgICAgICAgJ29iamVjdHMgdG8gcmVtb3ZlIG11c3QgYmUgYW4gYXJyYXknXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB2YXIgdG9SZW1vdmUgPSBvYmplY3RzLm1hcCh0cmFuc2Zvcm1JbnRlcmlvckF0b20pO1xuICAgICAgaWYgKGZsYXR0ZW4pIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHsgX19vcDogJyRwdWxsQWxsJywgYXJnOiB0b1JlbW92ZSB9O1xuICAgICAgfVxuXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgUGFyc2UuRXJyb3IuQ09NTUFORF9VTkFWQUlMQUJMRSxcbiAgICAgICAgYFRoZSAke19fb3B9IG9wZXJhdG9yIGlzIG5vdCBzdXBwb3J0ZWQgeWV0LmBcbiAgICAgICk7XG4gIH1cbn1cbmZ1bmN0aW9uIG1hcFZhbHVlcyhvYmplY3QsIGl0ZXJhdG9yKSB7XG4gIGNvbnN0IHJlc3VsdCA9IHt9O1xuICBPYmplY3Qua2V5cyhvYmplY3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICByZXN1bHRba2V5XSA9IGl0ZXJhdG9yKG9iamVjdFtrZXldKTtcbiAgfSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmNvbnN0IG5lc3RlZE1vbmdvT2JqZWN0VG9OZXN0ZWRQYXJzZU9iamVjdCA9IG1vbmdvT2JqZWN0ID0+IHtcbiAgc3dpdGNoICh0eXBlb2YgbW9uZ29PYmplY3QpIHtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIHJldHVybiBtb25nb09iamVjdDtcbiAgICBjYXNlICdzeW1ib2wnOlxuICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgIHRocm93ICdiYWQgdmFsdWUgaW4gbmVzdGVkTW9uZ29PYmplY3RUb05lc3RlZFBhcnNlT2JqZWN0JztcbiAgICBjYXNlICdvYmplY3QnOlxuICAgICAgaWYgKG1vbmdvT2JqZWN0ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKG1vbmdvT2JqZWN0IGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIG1vbmdvT2JqZWN0Lm1hcChuZXN0ZWRNb25nb09iamVjdFRvTmVzdGVkUGFyc2VPYmplY3QpO1xuICAgICAgfVxuXG4gICAgICBpZiAobW9uZ29PYmplY3QgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIHJldHVybiBQYXJzZS5fZW5jb2RlKG1vbmdvT2JqZWN0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1vbmdvT2JqZWN0IGluc3RhbmNlb2YgbW9uZ29kYi5Mb25nKSB7XG4gICAgICAgIHJldHVybiBtb25nb09iamVjdC50b051bWJlcigpO1xuICAgICAgfVxuXG4gICAgICBpZiAobW9uZ29PYmplY3QgaW5zdGFuY2VvZiBtb25nb2RiLkRvdWJsZSkge1xuICAgICAgICByZXR1cm4gbW9uZ29PYmplY3QudmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChCeXRlc0NvZGVyLmlzVmFsaWREYXRhYmFzZU9iamVjdChtb25nb09iamVjdCkpIHtcbiAgICAgICAgcmV0dXJuIEJ5dGVzQ29kZXIuZGF0YWJhc2VUb0pTT04obW9uZ29PYmplY3QpO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIG1vbmdvT2JqZWN0Lmhhc093blByb3BlcnR5KCdfX3R5cGUnKSAmJlxuICAgICAgICBtb25nb09iamVjdC5fX3R5cGUgPT0gJ0RhdGUnICYmXG4gICAgICAgIG1vbmdvT2JqZWN0LmlzbyBpbnN0YW5jZW9mIERhdGVcbiAgICAgICkge1xuICAgICAgICBtb25nb09iamVjdC5pc28gPSBtb25nb09iamVjdC5pc28udG9KU09OKCk7XG4gICAgICAgIHJldHVybiBtb25nb09iamVjdDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1hcFZhbHVlcyhtb25nb09iamVjdCwgbmVzdGVkTW9uZ29PYmplY3RUb05lc3RlZFBhcnNlT2JqZWN0KTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgJ3Vua25vd24ganMgdHlwZSc7XG4gIH1cbn07XG5cbmNvbnN0IHRyYW5zZm9ybVBvaW50ZXJTdHJpbmcgPSAoc2NoZW1hLCBmaWVsZCwgcG9pbnRlclN0cmluZykgPT4ge1xuICBjb25zdCBvYmpEYXRhID0gcG9pbnRlclN0cmluZy5zcGxpdCgnJCcpO1xuICBpZiAob2JqRGF0YVswXSAhPT0gc2NoZW1hLmZpZWxkc1tmaWVsZF0udGFyZ2V0Q2xhc3MpIHtcbiAgICB0aHJvdyAncG9pbnRlciB0byBpbmNvcnJlY3QgY2xhc3NOYW1lJztcbiAgfVxuICByZXR1cm4ge1xuICAgIF9fdHlwZTogJ1BvaW50ZXInLFxuICAgIGNsYXNzTmFtZTogb2JqRGF0YVswXSxcbiAgICBvYmplY3RJZDogb2JqRGF0YVsxXSxcbiAgfTtcbn07XG5cbi8vIENvbnZlcnRzIGZyb20gYSBtb25nby1mb3JtYXQgb2JqZWN0IHRvIGEgUkVTVC1mb3JtYXQgb2JqZWN0LlxuLy8gRG9lcyBub3Qgc3RyaXAgb3V0IGFueXRoaW5nIGJhc2VkIG9uIGEgbGFjayBvZiBhdXRoZW50aWNhdGlvbi5cbmNvbnN0IG1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdCA9IChjbGFzc05hbWUsIG1vbmdvT2JqZWN0LCBzY2hlbWEpID0+IHtcbiAgc3dpdGNoICh0eXBlb2YgbW9uZ29PYmplY3QpIHtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIHJldHVybiBtb25nb09iamVjdDtcbiAgICBjYXNlICdzeW1ib2wnOlxuICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgIHRocm93ICdiYWQgdmFsdWUgaW4gbW9uZ29PYmplY3RUb1BhcnNlT2JqZWN0JztcbiAgICBjYXNlICdvYmplY3QnOiB7XG4gICAgICBpZiAobW9uZ29PYmplY3QgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBpZiAobW9uZ29PYmplY3QgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICByZXR1cm4gbW9uZ29PYmplY3QubWFwKG5lc3RlZE1vbmdvT2JqZWN0VG9OZXN0ZWRQYXJzZU9iamVjdCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtb25nb09iamVjdCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgcmV0dXJuIFBhcnNlLl9lbmNvZGUobW9uZ29PYmplY3QpO1xuICAgICAgfVxuXG4gICAgICBpZiAobW9uZ29PYmplY3QgaW5zdGFuY2VvZiBtb25nb2RiLkxvbmcpIHtcbiAgICAgICAgcmV0dXJuIG1vbmdvT2JqZWN0LnRvTnVtYmVyKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtb25nb09iamVjdCBpbnN0YW5jZW9mIG1vbmdvZGIuRG91YmxlKSB7XG4gICAgICAgIHJldHVybiBtb25nb09iamVjdC52YWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKEJ5dGVzQ29kZXIuaXNWYWxpZERhdGFiYXNlT2JqZWN0KG1vbmdvT2JqZWN0KSkge1xuICAgICAgICByZXR1cm4gQnl0ZXNDb2Rlci5kYXRhYmFzZVRvSlNPTihtb25nb09iamVjdCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3RPYmplY3QgPSB7fTtcbiAgICAgIGlmIChtb25nb09iamVjdC5fcnBlcm0gfHwgbW9uZ29PYmplY3QuX3dwZXJtKSB7XG4gICAgICAgIHJlc3RPYmplY3QuX3JwZXJtID0gbW9uZ29PYmplY3QuX3JwZXJtIHx8IFtdO1xuICAgICAgICByZXN0T2JqZWN0Ll93cGVybSA9IG1vbmdvT2JqZWN0Ll93cGVybSB8fCBbXTtcbiAgICAgICAgZGVsZXRlIG1vbmdvT2JqZWN0Ll9ycGVybTtcbiAgICAgICAgZGVsZXRlIG1vbmdvT2JqZWN0Ll93cGVybTtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIga2V5IGluIG1vbmdvT2JqZWN0KSB7XG4gICAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgICAgY2FzZSAnX2lkJzpcbiAgICAgICAgICAgIHJlc3RPYmplY3RbJ29iamVjdElkJ10gPSAnJyArIG1vbmdvT2JqZWN0W2tleV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdfaGFzaGVkX3Bhc3N3b3JkJzpcbiAgICAgICAgICAgIHJlc3RPYmplY3QuX2hhc2hlZF9wYXNzd29yZCA9IG1vbmdvT2JqZWN0W2tleV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdfYWNsJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ19lbWFpbF92ZXJpZnlfdG9rZW4nOlxuICAgICAgICAgIGNhc2UgJ19wZXJpc2hhYmxlX3Rva2VuJzpcbiAgICAgICAgICBjYXNlICdfcGVyaXNoYWJsZV90b2tlbl9leHBpcmVzX2F0JzpcbiAgICAgICAgICBjYXNlICdfcGFzc3dvcmRfY2hhbmdlZF9hdCc6XG4gICAgICAgICAgY2FzZSAnX3RvbWJzdG9uZSc6XG4gICAgICAgICAgY2FzZSAnX2VtYWlsX3ZlcmlmeV90b2tlbl9leHBpcmVzX2F0JzpcbiAgICAgICAgICBjYXNlICdfYWNjb3VudF9sb2Nrb3V0X2V4cGlyZXNfYXQnOlxuICAgICAgICAgIGNhc2UgJ19mYWlsZWRfbG9naW5fY291bnQnOlxuICAgICAgICAgIGNhc2UgJ19wYXNzd29yZF9oaXN0b3J5JzpcbiAgICAgICAgICAgIC8vIFRob3NlIGtleXMgd2lsbCBiZSBkZWxldGVkIGlmIG5lZWRlZCBpbiB0aGUgREIgQ29udHJvbGxlclxuICAgICAgICAgICAgcmVzdE9iamVjdFtrZXldID0gbW9uZ29PYmplY3Rba2V5XTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ19zZXNzaW9uX3Rva2VuJzpcbiAgICAgICAgICAgIHJlc3RPYmplY3RbJ3Nlc3Npb25Ub2tlbiddID0gbW9uZ29PYmplY3Rba2V5XTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3VwZGF0ZWRBdCc6XG4gICAgICAgICAgY2FzZSAnX3VwZGF0ZWRfYXQnOlxuICAgICAgICAgICAgcmVzdE9iamVjdFsndXBkYXRlZEF0J10gPSBQYXJzZS5fZW5jb2RlKFxuICAgICAgICAgICAgICBuZXcgRGF0ZShtb25nb09iamVjdFtrZXldKVxuICAgICAgICAgICAgKS5pc287XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdjcmVhdGVkQXQnOlxuICAgICAgICAgIGNhc2UgJ19jcmVhdGVkX2F0JzpcbiAgICAgICAgICAgIHJlc3RPYmplY3RbJ2NyZWF0ZWRBdCddID0gUGFyc2UuX2VuY29kZShcbiAgICAgICAgICAgICAgbmV3IERhdGUobW9uZ29PYmplY3Rba2V5XSlcbiAgICAgICAgICAgICkuaXNvO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnZXhwaXJlc0F0JzpcbiAgICAgICAgICBjYXNlICdfZXhwaXJlc0F0JzpcbiAgICAgICAgICAgIHJlc3RPYmplY3RbJ2V4cGlyZXNBdCddID0gUGFyc2UuX2VuY29kZShuZXcgRGF0ZShtb25nb09iamVjdFtrZXldKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdsYXN0VXNlZCc6XG4gICAgICAgICAgY2FzZSAnX2xhc3RfdXNlZCc6XG4gICAgICAgICAgICByZXN0T2JqZWN0WydsYXN0VXNlZCddID0gUGFyc2UuX2VuY29kZShcbiAgICAgICAgICAgICAgbmV3IERhdGUobW9uZ29PYmplY3Rba2V5XSlcbiAgICAgICAgICAgICkuaXNvO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAndGltZXNVc2VkJzpcbiAgICAgICAgICBjYXNlICd0aW1lc191c2VkJzpcbiAgICAgICAgICAgIHJlc3RPYmplY3RbJ3RpbWVzVXNlZCddID0gbW9uZ29PYmplY3Rba2V5XTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAvLyBDaGVjayBvdGhlciBhdXRoIGRhdGEga2V5c1xuICAgICAgICAgICAgdmFyIGF1dGhEYXRhTWF0Y2ggPSBrZXkubWF0Y2goL15fYXV0aF9kYXRhXyhbYS16QS1aMC05X10rKSQvKTtcbiAgICAgICAgICAgIGlmIChhdXRoRGF0YU1hdGNoKSB7XG4gICAgICAgICAgICAgIHZhciBwcm92aWRlciA9IGF1dGhEYXRhTWF0Y2hbMV07XG4gICAgICAgICAgICAgIHJlc3RPYmplY3RbJ2F1dGhEYXRhJ10gPSByZXN0T2JqZWN0WydhdXRoRGF0YSddIHx8IHt9O1xuICAgICAgICAgICAgICByZXN0T2JqZWN0WydhdXRoRGF0YSddW3Byb3ZpZGVyXSA9IG1vbmdvT2JqZWN0W2tleV07XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoa2V5LmluZGV4T2YoJ19wXycpID09IDApIHtcbiAgICAgICAgICAgICAgdmFyIG5ld0tleSA9IGtleS5zdWJzdHJpbmcoMyk7XG4gICAgICAgICAgICAgIGlmICghc2NoZW1hLmZpZWxkc1tuZXdLZXldKSB7XG4gICAgICAgICAgICAgICAgbG9nLmluZm8oXG4gICAgICAgICAgICAgICAgICAndHJhbnNmb3JtLmpzJyxcbiAgICAgICAgICAgICAgICAgICdGb3VuZCBhIHBvaW50ZXIgY29sdW1uIG5vdCBpbiB0aGUgc2NoZW1hLCBkcm9wcGluZyBpdC4nLFxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAgbmV3S2V5XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoc2NoZW1hLmZpZWxkc1tuZXdLZXldLnR5cGUgIT09ICdQb2ludGVyJykge1xuICAgICAgICAgICAgICAgIGxvZy5pbmZvKFxuICAgICAgICAgICAgICAgICAgJ3RyYW5zZm9ybS5qcycsXG4gICAgICAgICAgICAgICAgICAnRm91bmQgYSBwb2ludGVyIGluIGEgbm9uLXBvaW50ZXIgY29sdW1uLCBkcm9wcGluZyBpdC4nLFxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAga2V5XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAobW9uZ29PYmplY3Rba2V5XSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlc3RPYmplY3RbbmV3S2V5XSA9IHRyYW5zZm9ybVBvaW50ZXJTdHJpbmcoXG4gICAgICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICAgICAgIG5ld0tleSxcbiAgICAgICAgICAgICAgICBtb25nb09iamVjdFtrZXldXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlbMF0gPT0gJ18nICYmIGtleSAhPSAnX190eXBlJykge1xuICAgICAgICAgICAgICB0aHJvdyAnYmFkIGtleSBpbiB1bnRyYW5zZm9ybTogJyArIGtleTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG1vbmdvT2JqZWN0W2tleV07XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBzY2hlbWEuZmllbGRzW2tleV0gJiZcbiAgICAgICAgICAgICAgICBzY2hlbWEuZmllbGRzW2tleV0udHlwZSA9PT0gJ0ZpbGUnICYmXG4gICAgICAgICAgICAgICAgRmlsZUNvZGVyLmlzVmFsaWREYXRhYmFzZU9iamVjdCh2YWx1ZSlcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgcmVzdE9iamVjdFtrZXldID0gRmlsZUNvZGVyLmRhdGFiYXNlVG9KU09OKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgc2NoZW1hLmZpZWxkc1trZXldICYmXG4gICAgICAgICAgICAgICAgc2NoZW1hLmZpZWxkc1trZXldLnR5cGUgPT09ICdHZW9Qb2ludCcgJiZcbiAgICAgICAgICAgICAgICBHZW9Qb2ludENvZGVyLmlzVmFsaWREYXRhYmFzZU9iamVjdCh2YWx1ZSlcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgcmVzdE9iamVjdFtrZXldID0gR2VvUG9pbnRDb2Rlci5kYXRhYmFzZVRvSlNPTih2YWx1ZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHNjaGVtYS5maWVsZHNba2V5XSAmJlxuICAgICAgICAgICAgICAgIHNjaGVtYS5maWVsZHNba2V5XS50eXBlID09PSAnUG9seWdvbicgJiZcbiAgICAgICAgICAgICAgICBQb2x5Z29uQ29kZXIuaXNWYWxpZERhdGFiYXNlT2JqZWN0KHZhbHVlKVxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICByZXN0T2JqZWN0W2tleV0gPSBQb2x5Z29uQ29kZXIuZGF0YWJhc2VUb0pTT04odmFsdWUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBzY2hlbWEuZmllbGRzW2tleV0gJiZcbiAgICAgICAgICAgICAgICBzY2hlbWEuZmllbGRzW2tleV0udHlwZSA9PT0gJ0J5dGVzJyAmJlxuICAgICAgICAgICAgICAgIEJ5dGVzQ29kZXIuaXNWYWxpZERhdGFiYXNlT2JqZWN0KHZhbHVlKVxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICByZXN0T2JqZWN0W2tleV0gPSBCeXRlc0NvZGVyLmRhdGFiYXNlVG9KU09OKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdE9iamVjdFtrZXldID0gbmVzdGVkTW9uZ29PYmplY3RUb05lc3RlZFBhcnNlT2JqZWN0KFxuICAgICAgICAgICAgICBtb25nb09iamVjdFtrZXldXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlbGF0aW9uRmllbGROYW1lcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5maWVsZHMpLmZpbHRlcihcbiAgICAgICAgZmllbGROYW1lID0+IHNjaGVtYS5maWVsZHNbZmllbGROYW1lXS50eXBlID09PSAnUmVsYXRpb24nXG4gICAgICApO1xuICAgICAgY29uc3QgcmVsYXRpb25GaWVsZHMgPSB7fTtcbiAgICAgIHJlbGF0aW9uRmllbGROYW1lcy5mb3JFYWNoKHJlbGF0aW9uRmllbGROYW1lID0+IHtcbiAgICAgICAgcmVsYXRpb25GaWVsZHNbcmVsYXRpb25GaWVsZE5hbWVdID0ge1xuICAgICAgICAgIF9fdHlwZTogJ1JlbGF0aW9uJyxcbiAgICAgICAgICBjbGFzc05hbWU6IHNjaGVtYS5maWVsZHNbcmVsYXRpb25GaWVsZE5hbWVdLnRhcmdldENsYXNzLFxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB7IC4uLnJlc3RPYmplY3QsIC4uLnJlbGF0aW9uRmllbGRzIH07XG4gICAgfVxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyAndW5rbm93biBqcyB0eXBlJztcbiAgfVxufTtcblxudmFyIERhdGVDb2RlciA9IHtcbiAgSlNPTlRvRGF0YWJhc2UoanNvbikge1xuICAgIHJldHVybiBuZXcgRGF0ZShqc29uLmlzbyk7XG4gIH0sXG5cbiAgaXNWYWxpZEpTT04odmFsdWUpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZS5fX3R5cGUgPT09ICdEYXRlJ1xuICAgICk7XG4gIH0sXG59O1xuXG52YXIgQnl0ZXNDb2RlciA9IHtcbiAgYmFzZTY0UGF0dGVybjogbmV3IFJlZ0V4cChcbiAgICAnXig/OltBLVphLXowLTkrL117NH0pKig/OltBLVphLXowLTkrL117Mn09PXxbQS1aYS16MC05Ky9dezN9PSk/JCdcbiAgKSxcbiAgaXNCYXNlNjRWYWx1ZShvYmplY3QpIHtcbiAgICBpZiAodHlwZW9mIG9iamVjdCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYmFzZTY0UGF0dGVybi50ZXN0KG9iamVjdCk7XG4gIH0sXG5cbiAgZGF0YWJhc2VUb0pTT04ob2JqZWN0KSB7XG4gICAgbGV0IHZhbHVlO1xuICAgIGlmICh0aGlzLmlzQmFzZTY0VmFsdWUob2JqZWN0KSkge1xuICAgICAgdmFsdWUgPSBvYmplY3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gb2JqZWN0LmJ1ZmZlci50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBfX3R5cGU6ICdCeXRlcycsXG4gICAgICBiYXNlNjQ6IHZhbHVlLFxuICAgIH07XG4gIH0sXG5cbiAgaXNWYWxpZERhdGFiYXNlT2JqZWN0KG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBtb25nb2RiLkJpbmFyeSB8fCB0aGlzLmlzQmFzZTY0VmFsdWUob2JqZWN0KTtcbiAgfSxcblxuICBKU09OVG9EYXRhYmFzZShqc29uKSB7XG4gICAgcmV0dXJuIG5ldyBtb25nb2RiLkJpbmFyeShuZXcgQnVmZmVyKGpzb24uYmFzZTY0LCAnYmFzZTY0JykpO1xuICB9LFxuXG4gIGlzVmFsaWRKU09OKHZhbHVlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwgJiYgdmFsdWUuX190eXBlID09PSAnQnl0ZXMnXG4gICAgKTtcbiAgfSxcbn07XG5cbnZhciBHZW9Qb2ludENvZGVyID0ge1xuICBkYXRhYmFzZVRvSlNPTihvYmplY3QpIHtcbiAgICByZXR1cm4ge1xuICAgICAgX190eXBlOiAnR2VvUG9pbnQnLFxuICAgICAgbGF0aXR1ZGU6IG9iamVjdFsxXSxcbiAgICAgIGxvbmdpdHVkZTogb2JqZWN0WzBdLFxuICAgIH07XG4gIH0sXG5cbiAgaXNWYWxpZERhdGFiYXNlT2JqZWN0KG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBBcnJheSAmJiBvYmplY3QubGVuZ3RoID09IDI7XG4gIH0sXG5cbiAgSlNPTlRvRGF0YWJhc2UoanNvbikge1xuICAgIHJldHVybiBbanNvbi5sb25naXR1ZGUsIGpzb24ubGF0aXR1ZGVdO1xuICB9LFxuXG4gIGlzVmFsaWRKU09OKHZhbHVlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwgJiYgdmFsdWUuX190eXBlID09PSAnR2VvUG9pbnQnXG4gICAgKTtcbiAgfSxcbn07XG5cbnZhciBQb2x5Z29uQ29kZXIgPSB7XG4gIGRhdGFiYXNlVG9KU09OKG9iamVjdCkge1xuICAgIC8vIENvbnZlcnQgbG5nL2xhdCAtPiBsYXQvbG5nXG4gICAgY29uc3QgY29vcmRzID0gb2JqZWN0LmNvb3JkaW5hdGVzWzBdLm1hcChjb29yZCA9PiB7XG4gICAgICByZXR1cm4gW2Nvb3JkWzFdLCBjb29yZFswXV07XG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIF9fdHlwZTogJ1BvbHlnb24nLFxuICAgICAgY29vcmRpbmF0ZXM6IGNvb3JkcyxcbiAgICB9O1xuICB9LFxuXG4gIGlzVmFsaWREYXRhYmFzZU9iamVjdChvYmplY3QpIHtcbiAgICBjb25zdCBjb29yZHMgPSBvYmplY3QuY29vcmRpbmF0ZXNbMF07XG4gICAgaWYgKG9iamVjdC50eXBlICE9PSAnUG9seWdvbicgfHwgIShjb29yZHMgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHBvaW50ID0gY29vcmRzW2ldO1xuICAgICAgaWYgKCFHZW9Qb2ludENvZGVyLmlzVmFsaWREYXRhYmFzZU9iamVjdChwb2ludCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgUGFyc2UuR2VvUG9pbnQuX3ZhbGlkYXRlKHBhcnNlRmxvYXQocG9pbnRbMV0pLCBwYXJzZUZsb2F0KHBvaW50WzBdKSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuXG4gIEpTT05Ub0RhdGFiYXNlKGpzb24pIHtcbiAgICBsZXQgY29vcmRzID0ganNvbi5jb29yZGluYXRlcztcbiAgICAvLyBBZGQgZmlyc3QgcG9pbnQgdG8gdGhlIGVuZCB0byBjbG9zZSBwb2x5Z29uXG4gICAgaWYgKFxuICAgICAgY29vcmRzWzBdWzBdICE9PSBjb29yZHNbY29vcmRzLmxlbmd0aCAtIDFdWzBdIHx8XG4gICAgICBjb29yZHNbMF1bMV0gIT09IGNvb3Jkc1tjb29yZHMubGVuZ3RoIC0gMV1bMV1cbiAgICApIHtcbiAgICAgIGNvb3Jkcy5wdXNoKGNvb3Jkc1swXSk7XG4gICAgfVxuICAgIGNvbnN0IHVuaXF1ZSA9IGNvb3Jkcy5maWx0ZXIoKGl0ZW0sIGluZGV4LCBhcikgPT4ge1xuICAgICAgbGV0IGZvdW5kSW5kZXggPSAtMTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXIubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgY29uc3QgcHQgPSBhcltpXTtcbiAgICAgICAgaWYgKHB0WzBdID09PSBpdGVtWzBdICYmIHB0WzFdID09PSBpdGVtWzFdKSB7XG4gICAgICAgICAgZm91bmRJbmRleCA9IGk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmb3VuZEluZGV4ID09PSBpbmRleDtcbiAgICB9KTtcbiAgICBpZiAodW5pcXVlLmxlbmd0aCA8IDMpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgUGFyc2UuRXJyb3IuSU5URVJOQUxfU0VSVkVSX0VSUk9SLFxuICAgICAgICAnR2VvSlNPTjogTG9vcCBtdXN0IGhhdmUgYXQgbGVhc3QgMyBkaWZmZXJlbnQgdmVydGljZXMnXG4gICAgICApO1xuICAgIH1cbiAgICAvLyBDb252ZXJ0IGxhdC9sb25nIC0+IGxvbmcvbGF0XG4gICAgY29vcmRzID0gY29vcmRzLm1hcChjb29yZCA9PiB7XG4gICAgICByZXR1cm4gW2Nvb3JkWzFdLCBjb29yZFswXV07XG4gICAgfSk7XG4gICAgcmV0dXJuIHsgdHlwZTogJ1BvbHlnb24nLCBjb29yZGluYXRlczogW2Nvb3Jkc10gfTtcbiAgfSxcblxuICBpc1ZhbGlkSlNPTih2YWx1ZSkge1xuICAgIHJldHVybiAoXG4gICAgICB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmIHZhbHVlLl9fdHlwZSA9PT0gJ1BvbHlnb24nXG4gICAgKTtcbiAgfSxcbn07XG5cbnZhciBGaWxlQ29kZXIgPSB7XG4gIGRhdGFiYXNlVG9KU09OKG9iamVjdCkge1xuICAgIHJldHVybiB7XG4gICAgICBfX3R5cGU6ICdGaWxlJyxcbiAgICAgIG5hbWU6IG9iamVjdCxcbiAgICB9O1xuICB9LFxuXG4gIGlzVmFsaWREYXRhYmFzZU9iamVjdChvYmplY3QpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PT0gJ3N0cmluZyc7XG4gIH0sXG5cbiAgSlNPTlRvRGF0YWJhc2UoanNvbikge1xuICAgIHJldHVybiBqc29uLm5hbWU7XG4gIH0sXG5cbiAgaXNWYWxpZEpTT04odmFsdWUpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZS5fX3R5cGUgPT09ICdGaWxlJ1xuICAgICk7XG4gIH0sXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdHJhbnNmb3JtS2V5LFxuICBwYXJzZU9iamVjdFRvTW9uZ29PYmplY3RGb3JDcmVhdGUsXG4gIHRyYW5zZm9ybVVwZGF0ZSxcbiAgdHJhbnNmb3JtV2hlcmUsXG4gIG1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdCxcbiAgcmVsYXRpdmVUaW1lVG9EYXRlLFxuICB0cmFuc2Zvcm1Db25zdHJhaW50LFxuICB0cmFuc2Zvcm1Qb2ludGVyU3RyaW5nLFxufTtcbiJdfQ==