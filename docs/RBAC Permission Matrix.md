# RBAC Permission Matrix

The MVP uses a deliberately simple permission model.

| Action                         |                         Finance |                          Member |
| ------------------------------ | ------------------------------: | ------------------------------: |
| View transparency dashboard    |                             Yes |                             Yes |
| Export finance data            |                             Yes |                             Yes |
| Submit uang kas proof          |                             Yes |                             Yes |
| Validate uang kas payment      |                             Yes |                              No |
| Submit reimbursement request   |                             Yes |                             Yes |
| Approve/reject reimbursement   |                             Yes |                              No |
| Record cashflow income/expense |                             Yes |                              No |
| Create categories              |                             Yes |                              No |
| Create programs/events         |                             Yes |                              No |
| Manage members                 | Deferred to future Peops module | Deferred to future Peops module |

## Notes

- [[BPH]], Ketua, Sekretaris, Kadiv, and staff are treated as [[Member]] unless they are assigned [[Finance]] access.
- Finance 1 and Finance 2 are operational scopes under [[Finance]], not separate roles for Phase 1a.
- Member administration belongs to the future shared ERP/Peops module, not the finance dashboard MVP.
