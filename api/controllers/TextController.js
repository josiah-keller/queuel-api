module.exports = {
  receiveText: async (req, res) => {
    let from = req.param("From");
    let body = req.param("Body");

    if (TextService.matchAnyKeyword(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"], body)) {
      try {
        await Group.updateCantText(true, from);
        return res.ok();
      } catch(err) {
        return res.ok();
      }
    }

    if (TextService.matchAnyKeyword(["START", "YES", "UNSTOP"], body)) {
      try {
        await Group.updateCantText(false, from);
        return res.ok();
      } catch(err) {
        return res.ok();
      }
    }

    if (TextService.matchKeyword("LEAVE", body)) {
      try {
        let canceledGroup = await Group.cancelReservations(from);
        await TextService.sendText("canceled", {
          groupName: canceledGroup.name,
        }, from);
        return res.ok();
      } catch(err) {
        return res.ok();
      }
    }

    await TextService.sendText("notMonitored", {}, from);
    return res.ok();
  },
};