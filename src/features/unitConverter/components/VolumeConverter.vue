<template>
  <BaseUnitConverter
    :units="VOLUME_UNITS"
    default-from="cubicMeter"
    default-to="liter"
  />
</template>

<script setup lang="ts">
import { VOLUME_UNITS } from "../utils/units"
import BaseUnitConverter from "./BaseUnitConverter.vue"
</script>
