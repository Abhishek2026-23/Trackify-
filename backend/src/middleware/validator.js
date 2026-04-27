const Joi = require('joi');

const schemas = {
  login: Joi.object({
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    password: Joi.string().min(8).required(),
  }),

  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    email: Joi.string().email().optional().allow('', null),
    password: Joi.string().min(8).required(),
    user_type: Joi.string().valid('commuter', 'driver', 'operator', 'admin').default('commuter'),
    vehicle_type: Joi.when('user_type', {
      is: 'driver',
      then: Joi.string().valid('bus', 'minibus', 'van', 'auto', 'taxi', 'Auto', 'Bus').required(),
      otherwise: Joi.optional(),
    }),
    vehicle_number: Joi.when('user_type', {
      is: 'driver',
      then: Joi.string().min(4).max(20).required(),
      otherwise: Joi.optional(),
    }),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  locationUpdate: Joi.object({
    trip_id: Joi.number().integer().optional(),
    bus_id: Joi.number().integer().optional(),
    driverId: Joi.string().optional(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    speed: Joi.number().min(0).max(300).optional(),
    heading: Joi.number().min(0).max(360).optional(),
    accuracy: Joi.number().min(0).optional(),
    isAvailable: Joi.boolean().optional(),
  }),

  passengerLocation: Joi.object({
    userId: Joi.string().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),

  tripStart: Joi.object({
    bus_id: Joi.number().integer().required(),
    route_id: Joi.number().integer().required(),
  }),

  createAlert: Joi.object({
    route_id: Joi.number().integer().optional(),
    trip_id: Joi.number().integer().optional(),
    alert_type: Joi.string().valid('delay', 'breakdown', 'route_change', 'cancellation').required(),
    message: Joi.string().min(5).max(500).required(),
    severity: Joi.string().valid('info', 'warning', 'critical').default('info'),
  }),

  createRoute: Joi.object({
    route_number: Joi.string().min(2).max(20).required(),
    route_name: Joi.string().min(3).max(100).required(),
    start_point: Joi.string().required(),
    end_point: Joi.string().required(),
    total_distance: Joi.number().positive().optional(),
    estimated_duration: Joi.number().integer().positive().optional(),
    stops: Joi.array().items(Joi.object({
      stop_name: Joi.string().required(),
      stop_code: Joi.string().optional(),
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      address: Joi.string().optional(),
    })).optional(),
  }),
};

const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: 'Validation schema not found' });
    }

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(422).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    req.validatedData = value;
    next();
  };
};

module.exports = { validate, schemas };
