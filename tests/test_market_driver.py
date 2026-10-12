import importlib.util
import unittest
from datetime import datetime, timezone
spec = importlib.util.spec_from_file_location('driver', 'scripts/run-market-scan.py')
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)
class DriverTest(unittest.TestCase):
    def test_existing_fresh_driver_is_not_duplicated(self):
        calls = []
        def call(action, body=None):
            calls.append(action)
            return {'progress': {'status':'running', 'updatedAt':datetime.now(timezone.utc).isoformat()}}
        self.assertIn('skipped', driver.drive(call))
        self.assertEqual(calls, ['status'])
    def test_retry_offset_reset_and_snapshot_readback(self):
        calls=[]
        runs=iter([
            {'runId':'r','status':'running','offset':0},
            {'runId':'r','status':'completed','total':1,'completed':1,'failed':0,'results':[{'symbol':'BTCUSDT'}]},
        ])
        def call(action, body=None):
            calls.append((action,body))
            if action=='status':return {'snapshot':{'runId':'r'}}
            if action=='begin':return {'runId':'r','status':'running','offset':12}
            return next(runs)
        result=driver.drive(call,sleep=lambda _:None)
        self.assertEqual(result['candidates'],1)
        self.assertEqual([c[1]['offset'] for c in calls if c[0]=='step'],[12,0])
        self.assertEqual(calls[-1][0],'status')
if __name__ == '__main__':unittest.main()
