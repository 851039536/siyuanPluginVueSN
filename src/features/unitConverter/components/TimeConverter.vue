<template>
  <BaseUnitConverter
    :units="TIME_UNITS"
    default-from="second"
    default-to="minute"
  />
</template>

<script setup lang="ts">
import { TIME_UNITS } from "../utils/units"
import BaseUnitConverter from "./BaseUnitConverter.vue"
</script>
