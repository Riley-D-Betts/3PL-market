export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, registerShipperSchema.parse)
  const passwordHash = await hashUserPassword(body.password)

  try {
    const [user] = await db.insert(users).values({
      email: body.email,
      passwordHash,
      name: body.name,
      phone: body.phone ?? null,
      role: 'shipper',
      billingEmail: body.billingEmail ?? null,
    }).returning()

    await setUserSession(event, { user: toSessionUser(user!) })
    return { user: toPublicUser(user!) }
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
    }
    throw err
  }
})
