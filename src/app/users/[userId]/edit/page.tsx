import { type NextServerPage } from "$react-types";
import { UserProfileForm } from "~/app/users/[userId]/edit/_components/user-profile-form";
import { userProfilePageParamsSchema } from "~/app/users/[userId]/userProfilePageParamsSchema";
import { db } from "~/server/db";

const EditUserProfilePage: NextServerPage = async ({ params }) => {
  const { userId } = userProfilePageParamsSchema.parse(params);

  const fullUser = await db.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
  });

  return <UserProfileForm user={fullUser} />;
};

export default EditUserProfilePage;
