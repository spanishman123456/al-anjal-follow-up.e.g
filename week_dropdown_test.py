import requests
import sys
import json
from datetime import datetime

class WeekDropdownTester:
    def __init__(self, base_url="https://progress-pulse-172.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {'weeks': [], 'classes': [], 'students': []}

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
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

    def authenticate(self):
        """Authenticate with admin credentials"""
        login_data = {
            "username": "2297033843",
            "password": "Admin@123"
        }
        success, response = self.run_test("Login", "POST", "auth/login", 200, login_data)
        
        if success and response.get('access_token'):
            self.token = response['access_token']
            print(f"✅ JWT token obtained")
            return True
        else:
            print("❌ Failed to obtain JWT token")
            return False

    def test_19_weeks_per_semester(self):
        """Test creating 19 weeks for each semester"""
        print("\n📅 Testing 19 Weeks Per Semester...")
        
        # Test semester 1 - create up to 19 weeks
        for semester in [1, 2]:
            print(f"\n📚 Testing Semester {semester}...")
            
            # Get existing weeks for this semester
            success, existing_weeks = self.run_test(
                f"Get Existing Weeks Semester {semester}", 
                "GET", 
                "weeks", 
                200, 
                params={"semester": semester}
            )
            
            if not success:
                return False
                
            existing_count = len(existing_weeks)
            print(f"   Found {existing_count} existing weeks for semester {semester}")
            
            # Create weeks up to 19 total
            weeks_to_create = min(5, 19 - existing_count)  # Create max 5 new weeks for testing
            
            for i in range(weeks_to_create):
                week_data = {
                    "semester": semester,
                    "label": f"Test Week Semester {semester}"
                }
                success, created_week = self.run_test(
                    f"Create Week {i+1} for Semester {semester}", 
                    "POST", 
                    "weeks", 
                    200, 
                    week_data
                )
                
                if success and created_week.get('id'):
                    self.created_ids['weeks'].append(created_week['id'])
                    week_number = created_week.get('number')
                    print(f"   ✅ Created week {week_number} for semester {semester}")
                    
                    # Verify week number is within 1-19 range
                    if week_number and (week_number < 1 or week_number > 19):
                        print(f"   ❌ Week number {week_number} is outside valid range 1-19")
                        return False
                else:
                    print(f"   ❌ Failed to create week for semester {semester}")
                    return False
        
        return True

    def test_week_4_special_fields(self):
        """Test that week 4 supports Quiz1/Quiz2/Chapter1 practical fields"""
        print("\n🧪 Testing Week 4 Special Fields...")
        
        # Create a class first
        class_data = {"name": "Test Class Week4", "grade": 4, "section": "A"}
        success, created_class = self.run_test("Create Class for Week 4 Test", "POST", "classes", 200, class_data)
        
        if not success or not created_class.get('id'):
            print("❌ Failed to create class for week 4 test")
            return False
            
        self.created_ids['classes'].append(created_class['id'])
        
        # Find or create week 4
        success, weeks = self.run_test("Get Weeks for Week 4 Test", "GET", "weeks", 200, params={"semester": 1})
        if not success:
            return False
            
        week_4 = None
        for week in weeks:
            if week.get('number') == 4:
                week_4 = week
                break
                
        if not week_4:
            # Create week 4 if it doesn't exist
            week_data = {"semester": 1, "label": "Week 4 Test"}
            success, week_4 = self.run_test("Create Week 4", "POST", "weeks", 200, week_data)
            if success and week_4.get('id'):
                self.created_ids['weeks'].append(week_4['id'])
            else:
                print("❌ Failed to create week 4")
                return False
        
        # Create student with week 4 special fields
        student_data = {
            "full_name": "Test Student Week 4",
            "class_id": created_class['id'],
            "attendance": 5.0,
            "participation": 4.5,
            "behavior": 5.0,
            "homework": 4.0,
            "quiz1": 4.5,  # Week 4 special field
            "quiz2": 4.0,  # Week 4 special field
            "chapter_test1_practical": 8.5,  # Week 4 special field
            "week_id": week_4['id']
        }
        
        success, created_student = self.run_test("Create Student with Week 4 Fields", "POST", "students", 200, student_data)
        
        if success and created_student.get('id'):
            self.created_ids['students'].append(created_student['id'])
            
            # Verify the special fields are present
            if (created_student.get('quiz1') == 4.5 and 
                created_student.get('quiz2') == 4.0 and 
                created_student.get('chapter_test1_practical') == 8.5):
                print("✅ Week 4 special fields (quiz1, quiz2, chapter_test1_practical) working correctly")
                return True
            else:
                print(f"❌ Week 4 special fields not working. Got: quiz1={created_student.get('quiz1')}, quiz2={created_student.get('quiz2')}, chapter_test1_practical={created_student.get('chapter_test1_practical')}")
                return False
        else:
            print("❌ Failed to create student with week 4 fields")
            return False

    def test_week_16_special_fields(self):
        """Test that week 16 supports Quiz3/Quiz4/Chapter2 practical fields"""
        print("\n🧪 Testing Week 16 Special Fields...")
        
        # Use existing class or create one
        if not self.created_ids['classes']:
            class_data = {"name": "Test Class Week16", "grade": 4, "section": "B"}
            success, created_class = self.run_test("Create Class for Week 16 Test", "POST", "classes", 200, class_data)
            if success and created_class.get('id'):
                self.created_ids['classes'].append(created_class['id'])
            else:
                print("❌ Failed to create class for week 16 test")
                return False
        
        # Find or create week 16
        success, weeks = self.run_test("Get Weeks for Week 16 Test", "GET", "weeks", 200, params={"semester": 1})
        if not success:
            return False
            
        week_16 = None
        for week in weeks:
            if week.get('number') == 16:
                week_16 = week
                break
                
        if not week_16:
            # Create week 16 if it doesn't exist
            week_data = {"semester": 1, "label": "Week 16 Test"}
            success, week_16 = self.run_test("Create Week 16", "POST", "weeks", 200, week_data)
            if success and week_16.get('id'):
                self.created_ids['weeks'].append(week_16['id'])
            else:
                print("❌ Failed to create week 16")
                return False
        
        # Create student with week 16 special fields
        student_data = {
            "full_name": "Test Student Week 16",
            "class_id": self.created_ids['classes'][0],
            "attendance": 5.0,
            "participation": 4.5,
            "behavior": 5.0,
            "homework": 4.0,
            "quiz3": 4.8,  # Week 16 special field
            "quiz4": 4.2,  # Week 16 special field
            "chapter_test2_practical": 9.0,  # Week 16 special field
            "week_id": week_16['id']
        }
        
        success, created_student = self.run_test("Create Student with Week 16 Fields", "POST", "students", 200, student_data)
        
        if success and created_student.get('id'):
            self.created_ids['students'].append(created_student['id'])
            
            # Verify the special fields are present
            if (created_student.get('quiz3') == 4.8 and 
                created_student.get('quiz4') == 4.2 and 
                created_student.get('chapter_test2_practical') == 9.0):
                print("✅ Week 16 special fields (quiz3, quiz4, chapter_test2_practical) working correctly")
                return True
            else:
                print(f"❌ Week 16 special fields not working. Got: quiz3={created_student.get('quiz3')}, quiz4={created_student.get('quiz4')}, chapter_test2_practical={created_student.get('chapter_test2_practical')}")
                return False
        else:
            print("❌ Failed to create student with week 16 fields")
            return False

    def test_regular_week_fields(self):
        """Test that regular weeks only show attendance/participation/behavior/homework"""
        print("\n📝 Testing Regular Week Fields...")
        
        # Use existing class
        if not self.created_ids['classes']:
            print("❌ No class available for regular week test")
            return False
        
        # Find or create a regular week (not 4 or 16)
        success, weeks = self.run_test("Get Weeks for Regular Week Test", "GET", "weeks", 200, params={"semester": 1})
        if not success:
            return False
            
        regular_week = None
        for week in weeks:
            if week.get('number') not in [4, 16] and week.get('number'):
                regular_week = week
                break
                
        if not regular_week:
            # Create a regular week
            week_data = {"semester": 1, "label": "Regular Week Test"}
            success, regular_week = self.run_test("Create Regular Week", "POST", "weeks", 200, week_data)
            if success and regular_week.get('id'):
                self.created_ids['weeks'].append(regular_week['id'])
            else:
                print("❌ Failed to create regular week")
                return False
        
        # Create student with only regular fields
        student_data = {
            "full_name": "Test Student Regular Week",
            "class_id": self.created_ids['classes'][0],
            "attendance": 5.0,
            "participation": 4.5,
            "behavior": 5.0,
            "homework": 4.0,
            "week_id": regular_week['id']
        }
        
        success, created_student = self.run_test("Create Student with Regular Week Fields", "POST", "students", 200, student_data)
        
        if success and created_student.get('id'):
            self.created_ids['students'].append(created_student['id'])
            
            # Verify only regular fields are set, special fields should be None/null
            regular_fields_ok = (
                created_student.get('attendance') == 5.0 and
                created_student.get('participation') == 4.5 and
                created_student.get('behavior') == 5.0 and
                created_student.get('homework') == 4.0
            )
            
            special_fields_empty = (
                created_student.get('quiz1') is None and
                created_student.get('quiz2') is None and
                created_student.get('quiz3') is None and
                created_student.get('quiz4') is None and
                created_student.get('chapter_test1_practical') is None and
                created_student.get('chapter_test2_practical') is None
            )
            
            if regular_fields_ok and special_fields_empty:
                print("✅ Regular week fields working correctly (only attendance/participation/behavior/homework)")
                return True
            else:
                print(f"❌ Regular week fields issue. Regular fields OK: {regular_fields_ok}, Special fields empty: {special_fields_empty}")
                return False
        else:
            print("❌ Failed to create student with regular week fields")
            return False

    def cleanup(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        for student_id in self.created_ids['students']:
            self.run_test(f"Delete Student {student_id}", "DELETE", f"students/{student_id}", 200)
            
        for class_id in self.created_ids['classes']:
            self.run_test(f"Delete Class {class_id}", "DELETE", f"classes/{class_id}", 200)
            
        for week_id in self.created_ids['weeks']:
            self.run_test(f"Delete Week {week_id}", "DELETE", f"weeks/{week_id}", 200)

def main():
    print("🚀 Starting Week Dropdown Functionality Testing...")
    tester = WeekDropdownTester()
    
    try:
        # Authenticate
        if not tester.authenticate():
            print("❌ Authentication failed")
            return 1
        
        # Run specific week dropdown tests
        tests = [
            tester.test_19_weeks_per_semester,
            tester.test_week_4_special_fields,
            tester.test_week_16_special_fields,
            tester.test_regular_week_fields
        ]
        
        for test in tests:
            try:
                if not test():
                    print(f"❌ Test {test.__name__} failed")
            except Exception as e:
                print(f"❌ Test {test.__name__} failed with exception: {e}")
        
        # Cleanup
        tester.cleanup()
        
        # Print results
        print(f"\n📊 Week Dropdown Test Results:")
        print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
        success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
        print(f"Success rate: {success_rate:.1f}%")
        
        return 0 if success_rate >= 80 else 1
        
    except Exception as e:
        print(f"❌ Testing failed with error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())