import {
  approveApproval,
  getPendingApprovals,
  rejectApproval,
  requestApproval,
  requestChanges
} from '../services/approval.service.js';

export const requestApprovalHandler = async (req, res, next) => {
  try {
    const approval = await requestApproval({
      variantId: req.body.variantId,
      comment: req.body.comment,
      user: req.user
    });

    res.status(201).json({ data: { approval } });
  } catch (error) {
    next(error);
  }
};

export const getPendingApprovalsHandler = async (req, res, next) => {
  try {
    const approvals = await getPendingApprovals({ user: req.user });
    res.json({ data: { approvals } });
  } catch (error) {
    next(error);
  }
};

export const approveApprovalHandler = async (req, res, next) => {
  try {
    const result = await approveApproval({
      approvalId: req.params.id,
      user: req.user,
      comment: req.body.comment
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const rejectApprovalHandler = async (req, res, next) => {
  try {
    const result = await rejectApproval({
      approvalId: req.params.id,
      user: req.user,
      comment: req.body.comment
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const requestChangesHandler = async (req, res, next) => {
  try {
    const result = await requestChanges({
      approvalId: req.params.id,
      user: req.user,
      comment: req.body.comment
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
