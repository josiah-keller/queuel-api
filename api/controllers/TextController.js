module.exports = {
  receiveText: async (req, res) => {
    let from = req.param("From");
    let body = req.param("Body");

    if (TextService.matchKeyword("STOP", body)) {
      try {
        await Group.updateCantText(true, from);
        return res.ok();
      } catch(err) {
        return res.ok();
      }
    }

    if (TextService.matchKeyword("START", body)) {
      try {
        await Group.updateCantText(false, from);
        return res.ok();
      } catch(err) {
        return res.ok();
      }
    }

    if (TextService.matchKeyword("CANCEL", body)) {
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