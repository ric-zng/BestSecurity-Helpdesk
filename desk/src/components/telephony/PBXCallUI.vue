<template>
  <div v-show="showCallPopup" v-bind="$attrs">
    <div
      ref="callPopup"
      class="fixed z-20 flex w-60 cursor-move select-none flex-col rounded-lg bg-surface-gray-7 p-4 !text-ink-gray-2 shadow-2xl"
      :style="style"
    >
      <div class="flex flex-row-reverse items-center gap-1">
        <MinimizeIcon
          class="h-4 w-4 cursor-pointer"
          @click="toggleCallWindow"
        />
      </div>
      <div class="flex flex-col items-center justify-center gap-3">
        <Avatar
          :image="contact?.image"
          :label="contact?.full_name"
          class="relative flex !h-24 !w-24 items-center justify-center [&>div]:text-[30px]"
          :class="onCall || calling ? '' : 'pulse'"
        />
        <div class="flex flex-col items-center justify-center gap-1">
          <div class="text-xl font-medium">
            {{ contact?.full_name ?? "Unknown" }}
          </div>
          <div class="text-sm text-ink-gray-5">
            {{ contact?.mobile_no || contact?.phone }}
          </div>
        </div>
        <CountUpTimer ref="counterUp">
          <div v-if="onCall" class="my-1 text-base">
            {{ counterUp?.updatedTime }}
          </div>
        </CountUpTimer>
        <div v-if="!onCall" class="my-1 text-base">
          {{
            callStatus == "initiating"
              ? "Initiating call..."
              : callStatus == "ringing"
              ? "Ringing..."
              : calling
              ? "Calling..."
              : "Incoming call..."
          }}
        </div>
        <div v-if="onCall" class="flex gap-2">
          <Button
            class="rounded-full bg-surface-red-5 hover:bg-surface-red-6"
            @click="hangUpCall"
          >
            <template #icon>
              <LucidePhone class="h-4 w-4 rotate-[135deg] text-ink-white" />
            </template>
          </Button>
        </div>
        <div v-else-if="calling || callStatus == 'initiating'">
          <Button
            size="md"
            variant="solid"
            theme="red"
            :label="'Cancel'"
            @click="cancelCall"
            class="rounded-lg"
          >
            <template #prefix>
              <LucidePhone class="h-4 w-4 rotate-[135deg]" />
            </template>
          </Button>
        </div>
        <div v-else class="flex gap-2">
          <Button
            size="md"
            variant="solid"
            theme="green"
            :label="'Accept'"
            class="rounded-lg"
            @click="acceptIncomingCall"
          >
            <template #prefix>
              <LucidePhone class="h-4 w-4" />
            </template>
          </Button>
          <Button
            size="md"
            variant="solid"
            theme="red"
            :label="'Reject'"
            class="rounded-lg"
            @click="rejectIncomingCall"
          >
            <template #prefix>
              <LucidePhone class="h-4 w-4 rotate-[135deg]" />
            </template>
          </Button>
        </div>
      </div>
    </div>
  </div>
  <div
    v-show="showSmallCallWindow"
    class="ml-2 mt-1 flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg bg-surface-gray-7 px-2 py-1 text-base !text-ink-gray-2"
    @click="toggleCallWindow"
    v-bind="$attrs"
  >
    <div class="flex items-center gap-2">
      <Avatar
        :image="contact?.image"
        :label="contact?.full_name"
        class="relative flex !h-5 !w-5 items-center justify-center"
      />
      <div class="max-w-[120px] truncate">
        {{ contact?.full_name ?? "Unknown" }}
      </div>
    </div>
    <div v-if="onCall" class="flex items-center gap-2">
      <div class="my-1 min-w-[40px] text-center">
        {{ counterUp?.updatedTime }}
      </div>
      <Button
        variant="solid"
        theme="red"
        class="!h-6 !w-6 rounded-full"
        @click.stop="hangUpCall"
      >
        <template #icon>
          <LucidePhone class="h-4 w-4 rotate-[135deg]" />
        </template>
      </Button>
    </div>
    <div v-else-if="calling" class="flex items-center gap-3">
      <div class="my-1">
        {{ callStatus == "ringing" ? "Ringing..." : "Calling..." }}
      </div>
      <Button
        variant="solid"
        theme="red"
        class="!h-6 !w-6 rounded-full"
        @click.stop="cancelCall"
      >
        <template #icon>
          <LucidePhone class="h-4 w-4 rotate-[135deg]" />
        </template>
      </Button>
    </div>
    <div v-else class="flex items-center gap-2">
      <Button
        variant="solid"
        theme="green"
        class="pulse relative !h-6 !w-6 rounded-full"
        @click.stop="acceptIncomingCall"
      >
        <template #icon>
          <LucidePhone class="h-4 w-4 animate-pulse" />
        </template>
      </Button>
      <Button
        variant="solid"
        theme="red"
        class="!h-6 !w-6 rounded-full"
        @click.stop="rejectIncomingCall"
      >
        <template #icon>
          <LucidePhone class="h-4 w-4 rotate-[135deg]" />
        </template>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTelephonyStore } from "@/stores/telephony";
import { useDraggable, useWindowSize } from "@vueuse/core";
import { Avatar, call, toast } from "frappe-ui";
import { computed, inject, onMounted, ref, watch } from "vue";
import LucidePhone from "~icons/lucide/phone";
import CountUpTimer from "./CountUpTimer.vue";
import MinimizeIcon from "./Icons/MinimizeIcon.vue";
import { socket } from "@/socket";

const telephonyStore = useTelephonyStore();

const onCallStarted = inject<() => void>("onCallStarted");
const onCallEnded = inject<() => void>("onCallEnded");
const onCallFailed = inject<() => void>("onCallFailed");

let showCallPopup = ref(false);
let showSmallCallWindow = ref(false);
let onCall = ref(false);
let calling = ref(false);
let callPopup = ref(null);
let counterUp = ref(null);
let contact = ref(null);
let callStatus = ref("");
let currentCallId = ref(null);
let currentPhoneNumber = ref(null);

const { width: windowWidth, height: windowHeight } = useWindowSize();
const { x, y, style } = useDraggable(callPopup, {
  initialValue: {
    x: windowWidth.value - 280,
    y: windowHeight.value - 520,
  },
});

const draggableStyle = computed(() => {
  return {
    left: `${x.value}px`,
    top: `${y.value}px`,
  };
});

function setup() {
  console.log("PBX CallUI setup");

  // Listen for incoming calls from PBX webhook
  socket.on("pbx_incoming_call", handleIncomingCall);

  // Listen for call status updates
  socket.on("pbx_call_status_update", handleCallStatusUpdate);

  // Listen for call ended
  socket.on("pbx_call_ended", handleCallEnded);
}

function handleIncomingCall(data) {
  console.log("PBX incoming call:", data);

  currentCallId.value = data.call_id;
  currentPhoneNumber.value = data.phone;

  // Lookup contact info
  lookupContact(data.phone);

  // Show call popup
  showCallPopup.value = true;
  showSmallCallWindow.value = false;
  calling.value = false;
  onCall.value = false;
  callStatus.value = "ringing";

  // Play ringtone sound (optional - not available in Vue SPA)
  // TODO: Implement audio notification using HTML5 Audio API
  // frappe.utils.play_sound("call");

  onCallStarted?.();
}

function handleCallStatusUpdate(data) {
  console.log("PBX call status update:", data);

  if (data.call_id === currentCallId.value) {
    if (data.status === "answered" || data.status === "In Progress") {
      onCall.value = true;
      calling.value = false;
      callStatus.value = "answered";
      counterUp.value?.startTimer();
    }
  }
}

function handleCallEnded(data) {
  console.log("PBX call ended:", data);

  if (data.call_id === currentCallId.value) {
    endCall();
  }
}

async function lookupContact(phoneNumber) {
  try {
    const result = await call("pbx_integration.api.lookup.by_phone", {
      phone_number: phoneNumber,
    });

    if (result && result.found) {
      contact.value = {
        full_name: result.contact_name || result.customer || result.lead || "Unknown",
        mobile_no: phoneNumber,
        phone: phoneNumber,
        image: null,
      };
    } else {
      contact.value = {
        full_name: "Unknown",
        mobile_no: phoneNumber,
        phone: phoneNumber,
        image: null,
      };
    }
  } catch (error) {
    console.error("Failed to lookup contact:", error);
    contact.value = {
      full_name: "Unknown",
      mobile_no: phoneNumber,
      phone: phoneNumber,
      image: null,
    };
  }
}

async function acceptIncomingCall() {
  console.log("Accepting PBX call:", currentCallId.value);

  try {
    const result = await call("pbx_integration.api.call.answer_call", {
      call_id: currentCallId.value,
    });

    if (result && result.success) {
      onCall.value = true;
      calling.value = false;
      callStatus.value = "answered";
      counterUp.value?.startTimer();
      toast.success("Call answered");
    } else {
      toast.error(result.message || "Failed to answer call");
    }
  } catch (error) {
    console.error("Failed to answer call:", error);
    toast.error("Failed to answer call");
  }
}

async function rejectIncomingCall() {
  console.log("Rejecting PBX call:", currentCallId.value);

  try {
    const result = await call("pbx_integration.api.call.hangup_call", {
      call_id: currentCallId.value,
    });

    if (result && result.success) {
      endCall();
      toast.info("Call rejected");
    } else {
      toast.error(result.message || "Failed to reject call");
      endCall();
    }
  } catch (error) {
    console.error("Failed to reject call:", error);
    toast.error("Failed to reject call");
    endCall();
  }
}

async function hangUpCall() {
  console.log("Hanging up PBX call:", currentCallId.value);

  try {
    const result = await call("pbx_integration.api.call.hangup_call", {
      call_id: currentCallId.value,
    });

    if (result && result.success) {
      toast.success("Call ended");
    } else {
      toast.error(result.message || "Failed to hang up");
    }
  } catch (error) {
    console.error("Failed to hang up call:", error);
    toast.error("Failed to hang up call");
  }

  endCall();
}

async function cancelCall() {
  console.log("Canceling PBX call:", currentCallId.value);

  if (currentCallId.value) {
    await hangUpCall();
  } else {
    endCall();
  }
}

function endCall() {
  console.log("Ending PBX call");

  onCall.value = false;
  calling.value = false;
  showCallPopup.value = false;
  showSmallCallWindow.value = false;
  currentCallId.value = null;
  currentPhoneNumber.value = null;
  contact.value = null;
  callStatus.value = "";

  counterUp.value?.resetTimer();

  onCallEnded?.();
}

async function makeOutgoingCall(phoneNumber) {
  console.log("Making outgoing PBX call to:", phoneNumber);

  currentPhoneNumber.value = phoneNumber;
  calling.value = true;
  onCall.value = false;
  callStatus.value = "initiating";

  // Lookup contact info
  await lookupContact(phoneNumber);

  // Show call popup
  showCallPopup.value = true;
  showSmallCallWindow.value = false;

  onCallStarted?.();

  try {
    const result = await call("pbx_integration.api.call.make_call", {
      callee: phoneNumber,
      link_doctype: telephonyStore.linkDoc.doctype,
      link_docname: telephonyStore.linkDoc.docname,
    });

    if (result && result.success) {
      currentCallId.value = result.call_id;
      callStatus.value = "ringing";
      toast.success(result.message);
    } else {
      toast.error(result.message || "Failed to initiate call");
      onCallFailed?.();
      endCall();
    }
  } catch (error) {
    console.error("Failed to make call:", error);
    toast.error("Failed to make call");
    onCallFailed?.();
    endCall();
  }
}

function toggleCallWindow() {
  if (showCallPopup.value) {
    showCallPopup.value = false;
    showSmallCallWindow.value = true;
  } else {
    showCallPopup.value = true;
    showSmallCallWindow.value = false;
  }
}

onMounted(() => {
  setup();
});

defineExpose({
  setup,
  makeOutgoingCall,
});
</script>

<style scoped>
.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
