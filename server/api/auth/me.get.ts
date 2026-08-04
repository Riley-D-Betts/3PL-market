export default defineEventHandler(async (event) => {
  const { user, company } = await requireAuth(event)
  return { user: toPublicUser(user), company }
})
