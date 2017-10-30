/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes map URLs to views and controllers.
 *
 * If Sails receives a URL that doesn't match any of the routes below,
 * it will check for matching files (images, scripts, stylesheets, etc.)
 * in your assets directory.  e.g. `http://localhost:1337/images/foo.jpg`
 * might match an image file: `/assets/images/foo.jpg`
 *
 * Finally, if those don't match either, the default 404 handler is triggered.
 * See `api/responses/notFound.js` to adjust your app's 404 logic.
 *
 * Note: Sails doesn't ACTUALLY serve stuff from `assets`-- the default Gruntfile in Sails copies
 * flat files from `assets` to `.tmp/public`.  This allows you to do things like compile LESS or
 * CoffeeScript for the front-end.
 *
 * For more information on configuring custom routes, check out:
 * http://sailsjs.org/#!/documentation/concepts/Routes/RouteTargetSyntax.html
 */

module.exports.routes = {
  "GET /queue": "QueueController.getQueues",
  "POST /queue": "QueueController.addQueue",
  "DELETE /queue/:id": "QueueController.deleteQueue",
  "POST /queue/:id": "QueueController.updateQueue",
  "POST /queue/:queueId/reorder": "QueueController.reorderGroup",
  "POST /queue/:queueId/advance": "QueueController.advanceQueue",
  "POST /queue/:queueId/reverse": "QueueController.reverseQueue",
  "POST /queue/:queueId/next": "QueueController.nextGroup",

  "GET /queue/:queueId/group": "GroupController.getGroupsByQueue",
  "POST /group": "GroupController.addGroup",
  "DELETE /group/:id": "GroupController.deleteGroup",
  "POST /group/:id": "GroupController.updateGroup",
};
