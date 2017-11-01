# Queuel Backend

This is the backend API for the Queuel application.  For more information, visit the [frontent repo](https://github.com/josiah-keller/queuel).

## Deployment

To run, this project requires an `npm install` to install dependencies, and needs the following environment variables:

|Variable|Description|
|--------|-----------|
|NODE_ENV|production|
|MONGO_URI|Connection string for the app's MongoDB database|
|TWILIO_SID|SID for Twilio text messaging API|
|TWILIO_TOKEN|Token for Twilio text messaging API|
|TWILIO_PHONE|"From" phone number for Twilio text messaging API|
|CORS_ORIGINS|Comma-delimited list of allowed origins for Cross Origin Resource Sharing (CORS)|
|CLIENT_PASSWORD|Password that will be required for clients to authenticate|

## License

This software is available under the MIT license.