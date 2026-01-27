<template>
  <Teleport to="body">
    <!-- Floating SMS Button -->
    <button
      v-if="!showDialog"
      @click="showDialog = true"
      class="sms-composer-fab"
      title="Send SMS"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <!-- SMS Dialog -->
    <Dialog v-model="showDialog" :options="{ title: 'Send SMS', size: 'sm' }">
      <template #body-content>
        <div class="sms-composer-container">
          <!-- Country Selector -->
          <div class="country-selector mb-4">
            <label class="block mb-2 font-semibold text-sm">Select Country</label>
            <input
              v-model="countrySearch"
              type="text"
              placeholder="Search country..."
              class="form-input w-full mb-2"
            />
            <div class="country-list border rounded max-h-40 overflow-y-auto p-1">
              <div
                v-for="country in filteredCountries"
                :key="country.code"
                @click="selectCountry(country)"
                :class="[
                  'country-item p-2 rounded cursor-pointer flex items-center gap-2',
                  selectedCountry?.code === country.code ? 'bg-green-100' : 'hover:bg-gray-100'
                ]"
              >
                <span class="text-xl">{{ country.flag }}</span>
                <span class="flex-1">{{ country.name }}</span>
                <span class="text-gray-500 text-sm">{{ country.code }}</span>
              </div>
            </div>
          </div>

          <!-- Phone Number Input -->
          <div class="phone-input mb-4">
            <label class="block mb-2 font-semibold text-sm">Phone Number</label>
            <div class="flex gap-2 items-center">
              <div class="country-code-display px-3 py-2 bg-gray-100 border rounded font-semibold min-w-[70px] text-center">
                {{ selectedCountry?.code || '+45' }}
              </div>
              <input
                v-model="phoneNumber"
                type="tel"
                placeholder="Enter phone number"
                class="form-input flex-1"
                @input="validatePhoneNumber"
              />
            </div>
          </div>

          <!-- Message Composer -->
          <div class="message-composer mb-4">
            <label class="block mb-2 font-semibold text-sm">Message</label>
            <textarea
              v-model="message"
              placeholder="Type your message..."
              class="form-input w-full"
              rows="4"
              maxlength="1600"
              @input="updateCharCount"
            ></textarea>
            <div class="flex justify-between text-sm mt-1">
              <span :class="charCount > 160 ? 'text-orange-600' : 'text-gray-500'">
                {{ charCount }} / 1600 characters
              </span>
              <span class="text-gray-500">
                {{ smsCount }} SMS{{ smsCount > 1 ? 's' : '' }}
              </span>
            </div>
          </div>

          <!-- Quick Templates (Optional) -->
          <div v-if="templates.length > 0" class="templates mb-4">
            <label class="block mb-2 font-semibold text-sm">Quick Templates</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="template in templates"
                :key="template.name"
                @click="useTemplate(template)"
                class="btn btn-sm btn-default"
              >
                {{ template.name }}
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <button
              @click="clearAll"
              class="btn btn-default flex-1 py-3"
            >
              Clear
            </button>
            <button
              @click="sendSMS"
              :disabled="!canSend"
              class="btn btn-primary flex-2 py-3 font-semibold"
              :class="{ 'opacity-50 cursor-not-allowed': !canSend }"
            >
              <svg class="w-5 h-5 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              Send SMS
            </button>
          </div>

          <!-- Sending Status -->
          <div v-if="sending" class="mt-4 text-center text-blue-600">
            Sending SMS...
          </div>
        </div>
      </template>
    </Dialog>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Dialog, call, toast } from 'frappe-ui';

const countries = [
  { name: 'Denmark', code: '+45', flag: '🇩🇰' },
  { name: 'Sweden', code: '+46', flag: '🇸🇪' },
  { name: 'Norway', code: '+47', flag: '🇳🇴' },
  { name: 'Finland', code: '+358', flag: '🇫🇮' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Spain', code: '+34', flag: '🇪🇸' },
  { name: 'Italy', code: '+39', flag: '🇮🇹' },
  { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { name: 'Belgium', code: '+32', flag: '🇧🇪' },
  { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { name: 'Austria', code: '+43', flag: '🇦🇹' },
  { name: 'Poland', code: '+48', flag: '🇵🇱' },
  { name: 'Tanzania', code: '+255', flag: '🇹🇿' },
  { name: 'Kenya', code: '+254', flag: '🇰🇪' },
  { name: 'Uganda', code: '+256', flag: '🇺🇬' },
  { name: 'Rwanda', code: '+250', flag: '🇷🇼' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'China', code: '+86', flag: '🇨🇳' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
].sort((a, b) => a.name.localeCompare(b.name));

// Quick message templates
const templates = [
  { name: 'Follow Up', message: 'Hi, this is a follow-up on your ticket. How can we help you further?' },
  { name: 'Resolved', message: 'Your ticket has been resolved. Please let us know if you need any additional assistance.' },
  { name: 'In Progress', message: 'We are working on your request and will update you shortly.' },
];

const showDialog = ref(false);
const selectedCountry = ref(countries.find(c => c.code === '+45')); // Default Denmark
const phoneNumber = ref('');
const message = ref('');
const countrySearch = ref('');
const charCount = ref(0);
const sending = ref(false);

const filteredCountries = computed(() => {
  if (!countrySearch.value) return countries;
  const search = countrySearch.value.toLowerCase();
  return countries.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.code.toLowerCase().includes(search)
  );
});

const smsCount = computed(() => {
  if (charCount.value === 0) return 0;
  if (charCount.value <= 160) return 1;
  return Math.ceil(charCount.value / 153); // 153 chars for multi-part SMS
});

const canSend = computed(() => {
  return selectedCountry.value && 
         phoneNumber.value.length > 0 && 
         message.value.length > 0 &&
         !sending.value;
});

function selectCountry(country) {
  selectedCountry.value = country;
}

function validatePhoneNumber() {
  // Remove non-numeric characters
  phoneNumber.value = phoneNumber.value.replace(/[^0-9]/g, '');
}

function updateCharCount() {
  charCount.value = message.value.length;
}

function useTemplate(template) {
  message.value = template.message;
  updateCharCount();
}

function clearAll() {
  phoneNumber.value = '';
  message.value = '';
  charCount.value = 0;
}

async function sendSMS() {
  if (!canSend.value) return;

  const fullNumber = selectedCountry.value.code + phoneNumber.value;
  
  sending.value = true;

  try {
    const response = await call('telephony.twilio.api.send_sms', {
      to_number: fullNumber,
      message: message.value,
      reference_doctype: '',
      reference_name: ''
    });

    if (response && response.success) {
      toast.success('SMS sent successfully!');
      showDialog.value = false;
      clearAll();
    } else {
      toast.error(response?.error || 'Failed to send SMS');
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    toast.error('An error occurred while sending SMS');
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.sms-composer-fab {
  position: fixed;
  bottom: 100px; /* Above phone dialer */
  right: 30px;
  z-index: 9999;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #10B981; /* Green color for SMS */
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.sms-composer-fab:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.sms-composer-fab svg {
  stroke: white;
}
</style>
