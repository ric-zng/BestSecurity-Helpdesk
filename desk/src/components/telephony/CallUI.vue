<template>
  <TwilioCallUI ref="twilio" />
  <ExotelCallUI ref="exotel" />
  <PBXCallUI ref="pbx" />
  <Dialog
    v-model="show"
    :options="{
      title: 'Make call',
      actions: [
        {
          label: `Call using ${callMedium}`,
          variant: 'solid',
          onClick: makeCallUsing,
        },
      ],
    }"
  >
    <template #body-content>
      <div class="flex flex-col gap-4">
        <FormControl type="text" v-model="mobileNumber" label="Mobile Number" />
        <FormControl
          type="select"
          v-model="callMedium"
          :label="'Calling Medium'"
          :options="callingMediumOptions"
        />
        <div class="flex flex-col gap-1">
          <FormControl
            type="checkbox"
            v-model="isDefaultMedium"
            :label="`Make ${callMedium} as default calling medium`"
          />

          <div v-if="isDefaultMedium" class="text-sm text-ink-gray-4">
            {{
              __("You can change the default calling medium from the settings")
            }}
          </div>
        </div>
      </div>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { FormControl, call, toast } from "frappe-ui";
import { computed, nextTick, ref, watch } from "vue";
import TwilioCallUI from "./TwilioCallUI.vue";
import ExotelCallUI from "./ExotelCallUI.vue";
import PBXCallUI from "./PBXCallUI.vue";
import { useTelephonyStore } from "@/stores/telephony";
import { storeToRefs } from "pinia";

const telephonyStore = useTelephonyStore();
const { defaultCallingMedium, isExotelEnabled, isTwilioEnabled, isPBXEnabled } =
  storeToRefs(telephonyStore);

const twilio = ref(null);
const exotel = ref(null);
const pbx = ref(null);

const callMedium = ref("Twilio");
const isDefaultMedium = ref(false);

const show = ref(false);
const mobileNumber = ref("");

const props = defineProps({
  userEmail: {
    type: String,
    default: "",
  },
});

const callingMediumOptions = computed(() => {
  const options = [];
  if (isTwilioEnabled.value) options.push("Twilio");
  if (isExotelEnabled.value) options.push("Exotel");
  if (isPBXEnabled.value) options.push("PBX");
  return options;
});

function makeCall({ number, doctype, docname }) {
  telephonyStore.setLinkDoc({
    docname,
    doctype,
  });

  const enabledCount = [isTwilioEnabled.value, isExotelEnabled.value, isPBXEnabled.value].filter(Boolean).length;

  if (
    (enabledCount > 1 && !defaultCallingMedium.value) ||
    !number
  ) {
    mobileNumber.value = number;
    show.value = true;
    return;
  }

  // Set default calling medium
  if (defaultCallingMedium.value) {
    callMedium.value = defaultCallingMedium.value;
  } else if (isPBXEnabled.value) {
    callMedium.value = "PBX";
  } else if (isTwilioEnabled.value) {
    callMedium.value = "Twilio";
  } else if (isExotelEnabled.value) {
    callMedium.value = "Exotel";
  }

  mobileNumber.value = number;
  makeCallUsing();
}

function makeCallUsing() {
  if (isDefaultMedium.value && callMedium.value) {
    setCallingMedium();
    isDefaultMedium.value = false;
  }

  if (callMedium.value === "Twilio") {
    twilio.value.makeOutgoingCall(mobileNumber.value);
  }

  if (callMedium.value === "Exotel") {
    exotel.value.makeOutgoingCall(mobileNumber.value);
  }

  if (callMedium.value === "PBX") {
    pbx.value.makeOutgoingCall(mobileNumber.value);
  }

  show.value = false;
}

async function setCallingMedium() {
  await call("telephony.api.set_default_calling_medium", {
    medium: callMedium.value,
  });

  telephonyStore.setDefaultCallingMedium(callMedium.value);
  telephonyStore.fetchCallIntegrationStatus();
  toast.success(
    `Default calling medium set successfully to ${callMedium.value}`
  );
}

watch(
  [isTwilioEnabled, isExotelEnabled, isPBXEnabled],
  ([twilioValue, exotelValue, pbxValue]) =>
    nextTick(() => {
      if (twilioValue) {
        twilio.value.setup();
        callMedium.value = "Twilio";
      }

      if (exotelValue) {
        exotel.value.setup(props.userEmail);
        callMedium.value = "Exotel";
      }

      if (pbxValue) {
        pbx.value.setup();
        callMedium.value = "PBX";
      }

      if (twilioValue || exotelValue || pbxValue) {
        if (pbxValue && !twilioValue && !exotelValue) {
          callMedium.value = "PBX";
        } else if (twilioValue) {
          callMedium.value = "Twilio";
        }
        telephonyStore.setMakeCall(makeCall);
      }
    }),
  { immediate: true }
);
</script>
