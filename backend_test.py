import requests
import sys
import json
from datetime import datetime

class EduTrackAPITester:
    def __init__(self, base_url="https://progress-pulse-172.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {
            'classes': [],
            'students': [],
            'roles': [],
            'users': [],
            'remedial_plans': [],
            'rewards': [],
            'weeks': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, auth_required=True):
        """Run a single API test"""
        if endpoint.startswith('auth/'):
            url = f"{self.base_url}/api/{endpoint}"
            # Special handling for auth/me endpoint which requires token
            if endpoint == 'auth/me' and self.token:
                headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {self.token}'}
            else:
                headers = {'Content-Type': 'application/json'}
        else:
            url = f"{self.base_url}/api/{endpoint}"
            headers = {'Content-Type': 'application/json'}
            
            # Add JWT token for protected endpoints
            if auth_required and self.token:
                headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_authentication(self):
        """Test JWT authentication with admin credentials"""
        print("\n🔐 Testing JWT Authentication...")
        
        # Test login with correct credentials
        login_data = {
            "username": "2297033843",  # Updated to actual admin username
            "password": "Admin@123"
        }
        success, response = self.run_test("Login with admin credentials", "POST", "auth/login", 200, login_data, auth_required=False)
        
        if success and response.get('access_token'):
            self.token = response['access_token']
            print(f"✅ JWT token obtained: {self.token[:20]}...")
            
            # Test /auth/me endpoint with token
            success_me, user_data = self.run_test("Get current user", "GET", "auth/me", 200)
            if success_me:
                print(f"✅ Current user: {user_data.get('name', 'Unknown')}")
            
            return True
        else:
            print("❌ Failed to obtain JWT token")
            return False
    
    def test_protected_endpoints_without_auth(self):
        """Test that protected endpoints require authentication"""
        print("\n🚫 Testing Protected Endpoints Without Auth...")
        
        # Temporarily remove token
        old_token = self.token
        self.token = None
        
        # These should all return 401 Unauthorized
        endpoints_to_test = [
            ("classes", "GET"),
            ("users", "GET"),
            ("analytics/summary", "GET")
        ]
        
        all_unauthorized = True
        for endpoint, method in endpoints_to_test:
            success, _ = self.run_test(f"Unauthorized {endpoint}", method, endpoint, 401)
            if not success:
                # If we didn't get 401, that's actually a failure for this test
                print(f"❌ Expected 401 for {endpoint} but got different status")
                all_unauthorized = False
        
        # Restore token
        self.token = old_token
        return all_unauthorized

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_notifications_endpoints(self):
        """Test notifications endpoints"""
        print("\n🔔 Testing Notifications Endpoints...")
        
        # Test get notifications
        success_get, notifications = self.run_test("Get Notifications", "GET", "notifications", 200)
        
        # Test get SMS templates
        success_templates, templates = self.run_test("Get SMS Templates", "GET", "notifications/templates", 200)
        
        # Test update SMS templates
        template_data = {
            "templates": {
                "calendar_sync": {
                    "ar": "تم تحديث التقويم الدراسي. عدد الأحداث: {count} بتاريخ {date}.",
                    "en": "Academic calendar synced. Events: {count} on {date}."
                }
            }
        }
        success_update, _ = self.run_test("Update SMS Templates", "POST", "notifications/templates", 200, template_data)
        
        return success_get and success_templates and success_update

    def test_user_profile_endpoints(self):
        """Test user profile endpoints"""
        print("\n👤 Testing User Profile Endpoints...")
        
        # Test get user profile
        success_get, profile = self.run_test("Get User Profile", "GET", "users/profile", 200)
        
        if success_get and profile:
            # Test update user profile
            profile_data = {
                "name": profile.get("name", "Administrator"),
                "email": profile.get("email", "admin@school.local"),
                "phone": "+966501234567"
            }
            success_update, _ = self.run_test("Update User Profile", "PUT", "users/profile/update", 200, profile_data)
            return success_update
        
        return success_get

    def test_analytics_summary_with_class_filter(self):
        """Test analytics summary with class filter - NEW FEATURE"""
        print("\n📊 Testing Analytics Summary with Class Filter...")
        
        # Test analytics without filter
        success_all, _ = self.run_test("Analytics Summary - All Classes", "GET", "analytics/summary", 200)
        
        # Test analytics with class filter
        if self.created_ids['classes']:
            class_id = self.created_ids['classes'][0]
            success_filtered, _ = self.run_test(
                "Analytics Summary - Filtered by Class", 
                "GET", 
                "analytics/summary", 
                200, 
                params={"class_id": class_id}
            )
            return success_all and success_filtered
        
        return success_all

    def test_analytics_summary(self):
        """Test analytics summary endpoint"""
        return self.run_test("Analytics Summary", "GET", "analytics/summary", 200)

    def test_classes_crud(self):
        """Test classes CRUD operations"""
        print("\n📚 Testing Classes CRUD...")
        
        # Get classes
        success, classes = self.run_test("Get Classes", "GET", "classes", 200)
        if not success:
            return False
            
        # Create class
        class_data = {
            "name": "Test Class 9C",
            "grade": 9,
            "section": "C"
        }
        success, created_class = self.run_test("Create Class", "POST", "classes", 200, class_data)
        if success and created_class.get('id'):
            self.created_ids['classes'].append(created_class['id'])
            
        # Get class summary
        success, _ = self.run_test("Get Class Summary", "GET", "classes/summary", 200)
        
        return success

    def test_weeks_crud(self):
        """Test weeks CRUD operations - NEW WEEKLY ORGANIZATION FEATURE"""
        print("\n📅 Testing Weeks CRUD...")
        
        # Get weeks
        success, weeks = self.run_test("Get Weeks", "GET", "weeks", 200)
        if not success:
            return False
            
        # Create week
        week_data = {"label": "Test Week"}
        success, created_week = self.run_test("Create Week", "POST", "weeks", 200, week_data)
        if success and created_week.get('id'):
            self.created_ids.setdefault('weeks', []).append(created_week['id'])
            print(f"✅ Created week with ID: {created_week['id']}, Number: {created_week.get('number')}")
            
            # Test delete week
            success_delete, _ = self.run_test("Delete Week", "DELETE", f"weeks/{created_week['id']}", 200)
            if success_delete:
                self.created_ids['weeks'].remove(created_week['id'])
                print("✅ Week deletion successful")
            else:
                print("❌ Week deletion failed")
                return False
        
        return success

    def test_students_crud(self):
        """Test students CRUD operations"""
        print("\n👥 Testing Students CRUD...")
        
        # Get students
        success, students = self.run_test("Get Students", "GET", "students", 200)
        if not success:
            return False
            
        # Create a week first for week-based testing
        week_data = {"label": "Test Week for Students"}
        success_week, created_week = self.run_test("Create Week for Students", "POST", "weeks", 200, week_data)
        week_id = None
        if success_week and created_week.get('id'):
            week_id = created_week['id']
            self.created_ids.setdefault('weeks', []).append(week_id)
            
        # Test students with week_id parameter
        if week_id:
            success_week_students, week_students = self.run_test(
                "Get Students for Week", 
                "GET", 
                "students", 
                200, 
                params={"week_id": week_id}
            )
            if not success_week_students:
                print("❌ Failed to get students for specific week")
                return False
            
        # Create student (need a class first)
        if self.created_ids['classes']:
            student_data = {
                "full_name": "Test Student",
                "class_id": self.created_ids['classes'][0],
                "quiz1": 4.5,
                "quiz2": 4.0,
                "chapter_test1": 8.5,
                "chapter_test2": 9.0,
                "week_id": week_id  # NEW: Include week_id in student creation
            }
            success, created_student = self.run_test("Create Student", "POST", "students", 200, student_data)
            if success and created_student.get('id'):
                self.created_ids['students'].append(created_student['id'])
                
                # Update student
                update_data = {"quiz1": 5.0, "week_id": week_id}
                success, _ = self.run_test("Update Student", "PUT", f"students/{created_student['id']}", 200, update_data)
                
                # Test bulk scores update with week_id - NEW FEATURE
                bulk_data = {
                    "updates": [
                        {
                            "id": created_student['id'],
                            "quiz1": 4.8,
                            "quiz2": 4.2,
                            "chapter_test1": 8.7,
                            "chapter_test2": 9.2
                        }
                    ],
                    "week_id": week_id  # NEW: Include week_id in bulk update
                }
                success_bulk, _ = self.run_test("Bulk Update Scores with Week", "POST", "students/bulk-scores", 200, bulk_data)
                if not success_bulk:
                    print("❌ Bulk scores update with week failed")
                    return False
        
        return success

    def test_roles_crud(self):
        """Test roles CRUD operations"""
        print("\n🔐 Testing Roles CRUD...")
        
        # Get roles
        success, roles = self.run_test("Get Roles", "GET", "roles", 200)
        if not success:
            return False
            
        # Create role
        role_data = {
            "name": "Test Role",
            "description": "Test role for testing",
            "permissions": ["test", "read"]
        }
        success, created_role = self.run_test("Create Role", "POST", "roles", 200, role_data)
        if success and created_role.get('id'):
            self.created_ids['roles'].append(created_role['id'])
        
        return success

    def test_users_crud(self):
        """Test users CRUD operations"""
        print("\n👤 Testing Users CRUD...")
        
        # Get users
        success, users = self.run_test("Get Users", "GET", "users", 200)
        if not success:
            return False
            
        # Create user (need a role first)
        if self.created_ids['roles']:
            user_data = {
                "name": "Test User",
                "email": "test@example.com",
                "username": "testuser",
                "password": "TestPass123!",
                "role_id": self.created_ids['roles'][0]
            }
            success, created_user = self.run_test("Create User", "POST", "users", 200, user_data)
            if success and created_user.get('id'):
                self.created_ids['users'].append(created_user['id'])
        
        return success

    def test_remedial_plans_crud(self):
        """Test remedial plans CRUD operations"""
        print("\n📋 Testing Remedial Plans CRUD...")
        
        # Get remedial plans
        success, plans = self.run_test("Get Remedial Plans", "GET", "remedial-plans", 200)
        if not success:
            return False
            
        # Create remedial plan (need a student first)
        if self.created_ids['students']:
            plan_data = {
                "student_id": self.created_ids['students'][0],
                "student_name": "Test Student",
                "class_name": "Test Class 9C",
                "focus_areas": ["Math", "Reading"],
                "strategies": ["Extra practice", "Tutoring"],
                "status": "active",
                "steps": [{"title": "Step 1"}, {"title": "Step 2"}]
            }
            success, created_plan = self.run_test("Create Remedial Plan", "POST", "remedial-plans", 200, plan_data)
            if success and created_plan.get('id'):
                self.created_ids['remedial_plans'].append(created_plan['id'])
        
        return success

    def test_rewards_crud(self):
        """Test rewards CRUD operations"""
        print("\n🏆 Testing Rewards CRUD...")
        
        # Get rewards
        success, rewards = self.run_test("Get Rewards", "GET", "rewards", 200)
        if not success:
            return False
            
        # Create reward (need a student first)
        if self.created_ids['students']:
            reward_data = {
                "student_id": self.created_ids['students'][0],
                "student_name": "Test Student",
                "class_name": "Test Class 9C",
                "title": "Excellence Award",
                "criteria": "High performance",
                "status": "proposed",
                "steps": [{"title": "Approve"}, {"title": "Deliver"}]
            }
            success, created_reward = self.run_test("Create Reward", "POST", "rewards", 200, reward_data)
            if success and created_reward.get('id'):
                self.created_ids['rewards'].append(created_reward['id'])
        
        return success

    def test_reports(self):
        """Test reports endpoint"""
        print("\n📊 Testing Reports...")
        
        # Test grade report
        success, _ = self.run_test("Grade Report", "GET", "reports/grade", 200, params={"grade": 4})
        return success

    def test_reports_export_endpoints(self):
        """Test new PDF/Excel export endpoints"""
        print("\n📄 Testing Reports Export Endpoints...")
        
        # Test PDF export
        success_pdf, _ = self.run_test(
            "Export Grade Report PDF", 
            "GET", 
            "reports/grade/export", 
            200, 
            params={"grade": 4, "format": "pdf", "report_type": "full"}
        )
        
        # Test Excel export  
        success_excel, _ = self.run_test(
            "Export Grade Report Excel", 
            "GET", 
            "reports/grade/export", 
            200, 
            params={"grade": 4, "format": "excel", "report_type": "full"}
        )
        
        # Test with summary report type
        success_summary, _ = self.run_test(
            "Export Grade Report PDF Summary", 
            "GET", 
            "reports/grade/export", 
            200, 
            params={"grade": 5, "format": "pdf", "report_type": "summary"}
        )
        
        return success_pdf and success_excel and success_summary

    def test_analytics_export_endpoints(self):
        """Test Analytics export endpoints - NEW FEATURE"""
        print("\n📊 Testing Analytics Export Endpoints...")
        
        # Test Analytics PDF export
        success_analytics_pdf, _ = self.run_test(
            "Export Analytics Summary PDF", 
            "GET", 
            "analytics/summary/export", 
            200, 
            params={"format": "pdf"}
        )
        
        # Test Analytics Excel export  
        success_analytics_excel, _ = self.run_test(
            "Export Analytics Summary Excel", 
            "GET", 
            "analytics/summary/export", 
            200, 
            params={"format": "excel"}
        )
        
        return success_analytics_pdf and success_analytics_excel

    def test_classes_export_endpoints(self):
        """Test Classes export endpoints - NEW FEATURE"""
        print("\n🏫 Testing Classes Export Endpoints...")
        
        # Test Classes PDF export
        success_classes_pdf, _ = self.run_test(
            "Export Classes Summary PDF", 
            "GET", 
            "classes/summary/export", 
            200, 
            params={"format": "pdf"}
        )
        
        # Test Classes Excel export  
        success_classes_excel, _ = self.run_test(
            "Export Classes Summary Excel", 
            "GET", 
            "classes/summary/export", 
            200, 
            params={"format": "excel"}
        )
        
        return success_classes_pdf and success_classes_excel

    def test_reports_settings_endpoints(self):
        """Test reports settings endpoints for weekly email scheduling"""
        print("\n⚙️ Testing Reports Settings Endpoints...")
        
        # Test get settings
        success_get, settings = self.run_test("Get Report Settings", "GET", "reports/settings", 200)
        
        # Test update settings (schedule weekly email)
        settings_data = {
            "grade": 4,
            "report_type": "full"
        }
        success_post, updated_settings = self.run_test(
            "Update Report Settings", 
            "POST", 
            "reports/settings", 
            200, 
            settings_data
        )
        
        # Verify the response contains expected fields
        if success_post and updated_settings:
            expected_fields = ["status", "grade", "report_type", "updated_at"]
            has_fields = all(field in updated_settings for field in expected_fields)
            if has_fields:
                print("✅ Settings response contains all expected fields")
            else:
                print(f"❌ Missing fields in settings response: {updated_settings}")
                return False
        
        return success_get and success_post

    def cleanup(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete in reverse order to handle dependencies
        for reward_id in self.created_ids['rewards']:
            self.run_test(f"Delete Reward {reward_id}", "DELETE", f"rewards/{reward_id}", 200)
            
        for plan_id in self.created_ids['remedial_plans']:
            self.run_test(f"Delete Remedial Plan {plan_id}", "DELETE", f"remedial-plans/{plan_id}", 200)
            
        for user_id in self.created_ids['users']:
            self.run_test(f"Delete User {user_id}", "DELETE", f"users/{user_id}", 200)
            
        for role_id in self.created_ids['roles']:
            self.run_test(f"Delete Role {role_id}", "DELETE", f"roles/{role_id}", 200)
            
        for student_id in self.created_ids['students']:
            self.run_test(f"Delete Student {student_id}", "DELETE", f"students/{student_id}", 200)
            
        for class_id in self.created_ids['classes']:
            self.run_test(f"Delete Class {class_id}", "DELETE", f"classes/{class_id}", 200)
            
        for week_id in self.created_ids.get('weeks', []):
            self.run_test(f"Delete Week {week_id}", "DELETE", f"weeks/{week_id}", 200)

def main():
    print("🚀 Starting EduTrack API Testing...")
    tester = EduTrackAPITester()
    
    try:
        # First test authentication
        if not tester.test_authentication():
            print("❌ Authentication failed - cannot proceed with other tests")
            return 1
        
        # Test that endpoints are properly protected
        tester.test_protected_endpoints_without_auth()
        
        # Run all tests
        tests = [
            tester.test_root_endpoint,
            tester.test_analytics_summary,
            tester.test_analytics_summary_with_class_filter,
            tester.test_notifications_endpoints,
            tester.test_user_profile_endpoints,
            tester.test_classes_crud,
            tester.test_weeks_crud,
            tester.test_students_crud,
            tester.test_roles_crud,
            tester.test_users_crud,
            tester.test_remedial_plans_crud,
            tester.test_rewards_crud,
            tester.test_reports,
            tester.test_reports_export_endpoints,
            tester.test_analytics_export_endpoints,
            tester.test_classes_export_endpoints,
            tester.test_reports_settings_endpoints
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        # Cleanup
        tester.cleanup()
        
        # Print results
        print(f"\n📊 Test Results:")
        print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
        success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
        print(f"Success rate: {success_rate:.1f}%")
        
        return 0 if success_rate >= 80 else 1
        
    except Exception as e:
        print(f"❌ Testing failed with error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())